import time
from datetime import datetime
from typing import List, Dict, Any, Optional
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from backend.app.database.session import get_db
from backend.app.models.models import (
    Environment, Configuration, InfrastructureDefinition,
    EnvironmentVariable, SecretMetadata, RuntimeSnapshot,
    DriftRecord, Deployment, AuditLog, User, DeploymentPolicy
)
from backend.app.schemas.schemas import (
    ValidationResultSchema, DriftItemSchema, RootCauseAnalysisSchema,
    ProductionSafetyScoreSchema, FixDriftRequest
)
from backend.app.services.drift_engine import DriftDetectionEngine
from backend.app.routes.auth import get_optional_current_user
from backend.app.routes.operations import record_performance_metric, auto_create_incidents_for_drifts

validation_router = APIRouter(prefix="/api/validation", tags=["Validation & Drift Intelligence"])


@validation_router.post("/run/{env_name}", response_model=ValidationResultSchema)
def run_validation(
    env_name: str,
    user: Optional[User] = Depends(get_optional_current_user),
    db: Session = Depends(get_db)
):
    """Run full configuration drift detection, risk scoring, and deployment gate check."""
    t_val_start = time.perf_counter()
    env = db.query(Environment).filter(Environment.name == env_name.lower().strip()).first()
    if not env:
        raise HTTPException(status_code=404, detail=f"Environment '{env_name}' not found")

    policy = db.query(DeploymentPolicy).filter(DeploymentPolicy.environment == env_name).first()

    drifts, checks = DriftDetectionEngine.detect_drifts_for_environment(db, env_name)
    risk_info = DriftDetectionEngine.calculate_risk_and_decision(drifts, env_name, policy)
    fp_exp, fp_act, _ = DriftDetectionEngine.get_fingerprints(db, env.id)
    val_duration_ms = (time.perf_counter() - t_val_start) * 1000.0

    # Sync database DriftRecords
    db.query(DriftRecord).filter(DriftRecord.environment_id == env.id).delete()
    drift_items = []
    for d in drifts:
        rec = DriftRecord(
            environment_id=env.id,
            category=d["category"],
            key=d["key"],
            expected_value=str(d["expected_value"]),
            actual_value=str(d["actual_value"]),
            severity=d["severity"],
            risk_points=d.get("risk_points", 10),
            reason=d["reason"],
            impact=d.get("impact"),
            root_cause=d.get("root_cause"),
            recommended_fix=d.get("recommended_fix"),
            status="OPEN",
            created_at=datetime.utcnow()
        )
        db.add(rec)
        db.flush()
        drift_items.append(DriftItemSchema(
            id=rec.id,
            environment_id=env.id,
            category=d["category"],
            key=d["key"],
            expected_value=d["expected_value"],
            actual_value=d["actual_value"],
            severity=d["severity"],
            risk_points=d.get("risk_points", 10),
            reason=d["reason"],
            impact=d.get("impact"),
            root_cause=d.get("root_cause"),
            recommended_fix=d.get("recommended_fix"),
            status="OPEN",
            created_at=rec.created_at
        ))

    # Update Environment KPIs
    env.status = "DRIFT_DETECTED" if len(drifts) > 0 else "HEALTHY"
    env.drift_count = len(drifts)
    env.critical_drift_count = risk_info["critical_count"]
    env.deployment_status = risk_info["decision"]
    env.readiness_score = risk_info["readiness_score"]
    env.health_score = risk_info["health_score"]
    env.risk_points = risk_info["risk_points"]
    env.last_validation_time = datetime.utcnow()

    # Record Deployment Gate Check
    operator = user.email if user else "Automated CI/CD Pipeline"
    deployment = Deployment(
        environment_id=env.id,
        config_version=env.config_version,
        status="BLOCKED" if risk_info["decision"] == "BLOCKED" else "APPROVED",
        decision=risk_info["decision"],
        reason=risk_info["decision_reason"],
        drift_count=len(drifts),
        critical_count=risk_info["critical_count"],
        infrastructure_check=checks.get("infrastructure", "PASS"),
        env_var_check=checks.get("env_variable", "PASS"),
        secret_check=checks.get("secret_metadata", "PASS"),
        runtime_check=checks.get("runtime", "PASS"),
        validated_at=datetime.utcnow()
    )
    db.add(deployment)

    # Auto-create incidents for any CRITICAL drifts detected
    auto_create_incidents_for_drifts(db, env.name, drifts, operator=operator)

    # Record measured validation duration
    record_performance_metric(
        db,
        metric_type="VALIDATION",
        operation=f"validation_run:{env.name}",
        duration_ms=val_duration_ms,
        environment=env.name,
        success=risk_info["decision"] != "BLOCKED",
        details={"drift_count": len(drifts), "decision": risk_info["decision"]},
        commit=False,
    )

    # Audit Log
    audit = AuditLog(
        environment_id=env.id,
        environment_name=env.name,
        action="VALIDATION_RUN",
        user=operator,
        decision=risk_info["decision"],
        drift_count=len(drifts),
        critical_drift_count=risk_info["critical_count"],
        reason=f"Validation executed in {val_duration_ms:.2f}ms. Gatekeeper Decision: {risk_info['decision']}. Risk Score: {risk_info['risk_score']}/100.",
        timestamp=datetime.utcnow()
    )
    db.add(audit)
    db.commit()

    return ValidationResultSchema(
        environment_id=env.id,
        environment_name=env.name,
        status=env.status,
        config_version=env.config_version,
        readiness_score=risk_info["readiness_score"],
        health_score=risk_info["health_score"],
        risk_points=risk_info["risk_points"],
        risk_level=risk_info["risk_level"],
        risk_explanation=risk_info["risk_explanation"],
        deployment_decision=risk_info["decision"],
        decision_reason=risk_info["decision_reason"],
        drift_count=len(drifts),
        critical_count=risk_info["critical_count"],
        high_count=risk_info["high_count"],
        medium_count=risk_info["medium_count"],
        low_count=risk_info["low_count"],
        drifts=drift_items,
        fingerprint_expected=fp_exp,
        fingerprint_actual=fp_act,
        checks=checks,
        validated_at=env.last_validation_time
    )


@validation_router.get("/drifts/{env_name}", response_model=List[DriftItemSchema])
def get_environment_drifts(env_name: str, db: Session = Depends(get_db)):
    """Retrieve all detected drift records for an environment."""
    env = db.query(Environment).filter(Environment.name == env_name.lower().strip()).first()
    if not env:
        raise HTTPException(status_code=404, detail=f"Environment '{env_name}' not found")

    recs = db.query(DriftRecord).filter(DriftRecord.environment_id == env.id).all()
    return [
        DriftItemSchema(
            id=r.id,
            environment_id=r.environment_id,
            category=r.category,
            key=r.key,
            expected_value=r.expected_value,
            actual_value=r.actual_value,
            severity=r.severity,
            risk_points=r.risk_points or 10,
            reason=r.reason,
            impact=r.impact,
            root_cause=r.root_cause,
            recommended_fix=r.recommended_fix,
            status=r.status,
            created_at=r.created_at
        )
        for r in recs
    ]


@validation_router.get("/fingerprint/{env_name}")
def get_environment_fingerprint(env_name: str, db: Session = Depends(get_db)):
    """Get deterministic SHA-256 fingerprint of Expected vs Actual configurations."""
    env = db.query(Environment).filter(Environment.name == env_name.lower().strip()).first()
    if not env:
        raise HTTPException(status_code=404, detail=f"Environment '{env_name}' not found")

    fp_exp, fp_act, breakdown = DriftDetectionEngine.get_fingerprints(db, env.id)
    return {
        "environment": env.name,
        "expected_fingerprint": fp_exp,
        "actual_fingerprint": fp_act,
        "is_synchronized": fp_exp == fp_act,
        "components": breakdown
    }


@validation_router.get("/root-cause/{env_name}", response_model=RootCauseAnalysisSchema)
def get_root_cause(env_name: str, db: Session = Depends(get_db)):
    """Compute automated multi-factor root cause analysis."""
    env = db.query(Environment).filter(Environment.name == env_name.lower().strip()).first()
    if not env:
        raise HTTPException(status_code=404, detail=f"Environment '{env_name}' not found")

    drifts, _ = DriftDetectionEngine.detect_drifts_for_environment(db, env_name)
    analysis = DriftDetectionEngine.get_root_cause_analysis(drifts, env_name)
    return RootCauseAnalysisSchema(**analysis)


@validation_router.get("/safety-score/{env_name}", response_model=ProductionSafetyScoreSchema)
def get_safety_score(env_name: str, db: Session = Depends(get_db)):
    """Calculate Production Safety Score (0-100) with category breakdown."""
    env = db.query(Environment).filter(Environment.name == env_name.lower().strip()).first()
    if not env:
        raise HTTPException(status_code=404, detail=f"Environment '{env_name}' not found")

    drifts, _ = DriftDetectionEngine.detect_drifts_for_environment(db, env_name)
    score_info = DriftDetectionEngine.calculate_production_safety_score(drifts, env_name)
    return ProductionSafetyScoreSchema(**score_info)


@validation_router.post("/fix-drift")
def fix_single_drift(
    req: FixDriftRequest,
    user: Optional[User] = Depends(get_optional_current_user),
    db: Session = Depends(get_db)
):
    """
    Applies the recommended fix for a specific drift key in the environment,
    then automatically revalidates to update gatekeeper status.
    """
    env = db.query(Environment).filter(Environment.name == req.environment.lower().strip()).first()
    if not env:
        raise HTTPException(status_code=404, detail=f"Environment '{req.environment}' not found")

    operator = user.email if user else "System Operator"
    key = req.drift_key

    # Check Env Vars
    exp_var = db.query(EnvironmentVariable).filter(
        EnvironmentVariable.environment_id == env.id,
        EnvironmentVariable.is_actual == False,
        EnvironmentVariable.key == key
    ).first()

    if exp_var:
        target_val = req.target_value if req.target_value is not None else exp_var.value
        act_var = db.query(EnvironmentVariable).filter(
            EnvironmentVariable.environment_id == env.id,
            EnvironmentVariable.is_actual == True,
            EnvironmentVariable.key == key
        ).first()
        if act_var:
            act_var.value = str(target_val)
        else:
            db.add(EnvironmentVariable(environment_id=env.id, is_actual=True, key=key, value=str(target_val)))
    elif key in ["replicas", "max_connections", "cpu", "memory", "database"]:
        exp_infra = db.query(InfrastructureDefinition).filter(
            InfrastructureDefinition.environment_id == env.id,
            InfrastructureDefinition.is_actual == False
        ).first()
        act_infra = db.query(InfrastructureDefinition).filter(
            InfrastructureDefinition.environment_id == env.id,
            InfrastructureDefinition.is_actual == True
        ).first()
        if exp_infra and act_infra:
            setattr(act_infra, key, getattr(exp_infra, key))
    elif key in ["read_replica_enabled"]:
        act_infra = db.query(InfrastructureDefinition).filter(
            InfrastructureDefinition.environment_id == env.id,
            InfrastructureDefinition.is_actual == True
        ).first()
        if act_infra:
            import json
            data = json.loads(act_infra.raw_json) if act_infra.raw_json else {}
            data["readReplicaEnabled"] = True
            act_infra.raw_json = json.dumps(data)
    elif "STRIPE" in key or "SECRET" in key:
        exp_sec = db.query(SecretMetadata).filter(
            SecretMetadata.environment_id == env.id,
            SecretMetadata.is_actual == False,
            SecretMetadata.name == key
        ).first()
        act_sec = db.query(SecretMetadata).filter(
            SecretMetadata.environment_id == env.id,
            SecretMetadata.is_actual == True,
            SecretMetadata.name == key
        ).first()
        if exp_sec and act_sec:
            act_sec.version = exp_sec.version
            act_sec.status = "active"

    # Audit fix
    audit = AuditLog(
        environment_id=env.id,
        environment_name=env.name,
        action=f"DRIFT_FIX_APPLIED_{key}",
        user=operator,
        decision="APPROVED",
        reason=f"Applied smart fix to '{key}'. Reconciled parameter with declared baseline.",
        timestamp=datetime.utcnow()
    )
    db.add(audit)
    db.commit()

    # Auto-revalidate
    return run_validation(env.name, user=user, db=db)


@validation_router.post("/reconcile-all/{env_name}")
def reconcile_all_drifts(
    env_name: str,
    user: Optional[User] = Depends(get_optional_current_user),
    db: Session = Depends(get_db)
):
    """
    Reconciles all active configuration drifts to match baseline invariants,
    auto-revalidates to 0 drift, and updates Gatekeeper status to APPROVED.
    """
    from backend.app.services.simulation_service import FailureSimulationService
    operator = user.email if user else "System Operator"
    result = FailureSimulationService.recover_environment(db, env_name, operator)
    # Run validation to get updated schema
    return run_validation(env_name, user=user, db=db)
