from datetime import datetime
from typing import List, Dict, Any, Optional
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from backend.app.database.session import get_db
from backend.app.models.models import Deployment, Environment, AuditLog, User
from backend.app.services.drift_engine import DriftDetectionEngine
from backend.app.routes.auth import get_current_user, require_admin

deployments_router = APIRouter(prefix="/api/deployments", tags=["Deployments & Gatekeeper"])


@deployments_router.get("")
def list_deployments(
    limit: int = 50,
    db: Session = Depends(get_db)
):
    """List deployment gatekeeper records from database."""
    deployments = db.query(Deployment).order_by(Deployment.id.desc()).limit(limit).all()
    results = []
    for d in deployments:
        env = db.query(Environment).filter(Environment.id == d.environment_id).first()
        results.append({
            "id": d.id,
            "environment_id": d.environment_id,
            "environment_name": env.name if env else "unknown",
            "config_version": d.config_version,
            "status": d.status,
            "decision": d.decision,
            "reason": d.reason,
            "drift_count": d.drift_count,
            "critical_count": d.critical_count,
            "checks": {
                "infrastructure": d.infrastructure_check,
                "env_variable": d.env_var_check,
                "secret_metadata": d.secret_check,
                "runtime": d.runtime_check
            },
            "validated_at": d.validated_at.isoformat() if d.validated_at else None
        })
    return results


@deployments_router.get("/monitor/{env_name}")
def get_deployment_monitor(
    env_name: str,
    db: Session = Depends(get_db)
):
    """
    Real-Time Deployment Monitor endpoint: provides continuous step validation status
    for the pipeline execution.
    """
    env = db.query(Environment).filter(Environment.name == env_name.lower().strip()).first()
    if not env:
        raise HTTPException(status_code=404, detail=f"Environment '{env_name}' not found")

    drifts, checks = DriftDetectionEngine.detect_drifts_for_environment(db, env_name)
    risk_info = DriftDetectionEngine.calculate_risk_and_decision(drifts, env_name)
    fp_exp, fp_act, _ = DriftDetectionEngine.get_fingerprints(db, env.id)

    steps = [
        {
            "id": 1,
            "name": "Pipeline Trigger & Environment Identification",
            "status": "COMPLETED",
            "duration_ms": 12,
            "details": f"Target environment: {env.display_name} (v{env.config_version})"
        },
        {
            "id": 2,
            "name": "GitOps Declarative Baseline Extraction",
            "status": "COMPLETED",
            "duration_ms": 18,
            "details": f"Fingerprint: {fp_exp}"
        },
        {
            "id": 3,
            "name": "Live Infrastructure Invariant Verification",
            "status": "COMPLETED" if checks.get("infrastructure") == "PASS" else "FAILED",
            "duration_ms": 24,
            "verdict": checks.get("infrastructure", "PASS"),
            "details": "Replicas, CPU, Memory, Max DB Connections, and Read Replicas check"
        },
        {
            "id": 4,
            "name": "Environment Variables & Flash-Sale Flags",
            "status": "COMPLETED" if checks.get("env_variable") == "PASS" else "FAILED",
            "duration_ms": 15,
            "verdict": checks.get("env_variable", "PASS"),
            "details": "PAYMENT_MODE, PAYMENT_GATEWAY_URL, RATE_LIMITER, INVENTORY_CACHE_TTL check"
        },
        {
            "id": 5,
            "name": "KMS Secret Metadata & Version Freshness",
            "status": "COMPLETED" if checks.get("secret_metadata") == "PASS" else "FAILED",
            "duration_ms": 29,
            "verdict": checks.get("secret_metadata", "PASS"),
            "details": "STRIPE_API_SECRET, DB_MASTER_CREDENTIALS, JWT key versions verified"
        },
        {
            "id": 6,
            "name": "Running Container Telemetry & Runtime Snapshot",
            "status": "COMPLETED" if checks.get("runtime") == "PASS" else "FAILED",
            "duration_ms": 22,
            "verdict": checks.get("runtime", "PASS"),
            "details": f"Runtime fingerprint: {fp_act}"
        },
        {
            "id": 7,
            "name": "Intelligent Gatekeeper Policy Evaluation",
            "status": "BLOCKED" if risk_info["decision"] == "BLOCKED" else "APPROVED",
            "duration_ms": 10,
            "decision": risk_info["decision"],
            "risk_score": risk_info["risk_score"],
            "risk_level": risk_info["risk_level"],
            "details": risk_info["decision_reason"]
        }
    ]

    return {
        "environment": env.name,
        "config_version": env.config_version,
        "overall_status": risk_info["decision"],
        "risk_score": risk_info["risk_score"],
        "risk_level": risk_info["risk_level"],
        "drift_count": len(drifts),
        "critical_count": risk_info["critical_count"],
        "decision_reason": risk_info["decision_reason"],
        "steps": steps,
        "monitored_at": datetime.utcnow().isoformat()
    }


@deployments_router.post("/{deployment_id}/override")
def override_deployment_decision(
    deployment_id: int,
    action: str,  # APPROVE or REJECT
    reason: str,
    user: User = Depends(require_admin),
    db: Session = Depends(get_db)
):
    """Override a gatekeeper decision with required administrator justification."""
    dep = db.query(Deployment).filter(Deployment.id == deployment_id).first()
    if not dep:
        raise HTTPException(status_code=404, detail="Deployment record not found")

    action_upper = action.upper().strip()
    if action_upper not in ["APPROVE", "REJECT"]:
        raise HTTPException(status_code=400, detail="Action must be APPROVE or REJECT")

    dep.status = "APPROVED" if action_upper == "APPROVE" else "REJECTED"
    dep.decision = f"OVERRIDDEN_{action_upper}"
    dep.reason = f"Manual override by {user.name} ({user.email}): {reason}"

    audit = AuditLog(
        environment_id=dep.environment_id,
        action=f"DEPLOYMENT_OVERRIDE_{action_upper}",
        user=f"{user.name} ({user.email})",
        decision=dep.status,
        reason=reason,
        timestamp=datetime.utcnow()
    )
    db.add(audit)
    db.commit()

    return {
        "message": f"Deployment {deployment_id} successfully updated to {dep.status}.",
        "deployment_id": deployment_id,
        "new_status": dep.status,
        "override_by": user.email
    }
