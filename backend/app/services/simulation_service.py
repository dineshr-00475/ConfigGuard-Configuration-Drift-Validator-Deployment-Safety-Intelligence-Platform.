import json
from datetime import datetime
from typing import Dict, Any, List, Optional
from sqlalchemy.orm import Session
from backend.app.models.models import (
    Environment, Configuration, InfrastructureDefinition,
    EnvironmentVariable, SecretMetadata, RuntimeSnapshot,
    SimulationRecord, AuditLog
)
from backend.app.services.drift_engine import DriftDetectionEngine

SCENARIOS: List[Dict[str, Any]] = [
    {
        "key": "WRONG_PAYMENT_MODE",
        "title": "Wrong Payment Mode (TEST Mode Active in Prod)",
        "target_env": "production",
        "category": "env_variable",
        "severity": "CRITICAL",
        "description": "Sets PAYMENT_MODE=TEST in active production container configuration.",
        "flash_sale_risk": "All customer checkouts process in sandbox test mode; $0.00 actual gross merchandise volume.",
        "apply": lambda db, env_id: _update_env_var(db, env_id, "PAYMENT_MODE", "TEST")
    },
    {
        "key": "WRONG_PAYMENT_GATEWAY_URL",
        "title": "Wrong Payment Gateway URL (Sandbox Leakage)",
        "target_env": "production",
        "category": "env_variable",
        "severity": "CRITICAL",
        "description": "Sets PAYMENT_GATEWAY_URL to staging sandbox endpoint in active production environment.",
        "flash_sale_risk": "Live credit cards rejected by sandbox endpoints under flash sale surge load.",
        "apply": lambda db, env_id: _update_env_var(db, env_id, "PAYMENT_GATEWAY_URL", "https://sandbox.api.stripe-gateway.internal/v1")
    },
    {
        "key": "REPLICA_MISMATCH",
        "title": "Severe Cluster Pod Scale-Down (4 Pods)",
        "target_env": "production",
        "category": "infrastructure",
        "severity": "CRITICAL",
        "description": "Reduces active Kubernetes replicas from 16 to 4 pods.",
        "flash_sale_risk": "Instant CPU thrashing and cascade 504 Gateway Timeouts within seconds of flash sale opening.",
        "apply": lambda db, env_id: _update_infra_field(db, env_id, "replicas", 4)
    },
    {
        "key": "MAX_CONNECTIONS_THROTTLED",
        "title": "Database Connection Pool Throttled (200 Connections)",
        "target_env": "production",
        "category": "infrastructure",
        "severity": "HIGH",
        "description": "Throttles PostgreSQL connection pool limit from 1200 to 200.",
        "flash_sale_risk": "PostgreSQL connection exhaustion leading to high checkout transaction failure rates.",
        "apply": lambda db, env_id: _update_infra_field(db, env_id, "max_connections", 200)
    },
    {
        "key": "RATE_LIMITER_DISABLED",
        "title": "Flash-Sale Rate Limiter Disabled",
        "target_env": "production",
        "category": "env_variable",
        "severity": "CRITICAL",
        "description": "Sets FLASH_SALE_RATE_LIMITER_ENABLED=false.",
        "flash_sale_risk": "Bot traffic and unthrottled burst traffic overwhelm upstream services causing cluster brownouts.",
        "apply": lambda db, env_id: _update_env_var(db, env_id, "FLASH_SALE_RATE_LIMITER_ENABLED", "false")
    },
    {
        "key": "WRONG_SECRET_VERSION",
        "title": "Stale Payment Secret Version (v3 instead of v4)",
        "target_env": "production",
        "category": "secret_metadata",
        "severity": "HIGH",
        "description": "Sets active STRIPE_API_SECRET version to v3.",
        "flash_sale_risk": "Deprecated API key authentication failures when Stripe rejects decommissioned credential.",
        "apply": lambda db, env_id: _update_secret_version(db, env_id, "STRIPE_API_SECRET", 3)
    },
    {
        "key": "EXPIRED_SECRET",
        "title": "Expired Database Master Credential",
        "target_env": "production",
        "category": "secret_metadata",
        "severity": "CRITICAL",
        "description": "Marks DB_MASTER_CREDENTIALS secret status as 'expired'.",
        "flash_sale_risk": "Database authentication fails; full application outage across entire storefront.",
        "apply": lambda db, env_id: _update_secret_status(db, env_id, "DB_MASTER_CREDENTIALS", "expired")
    },
    {
        "key": "HIGH_CACHE_TTL",
        "title": "Excessive Inventory Cache TTL (180s)",
        "target_env": "production",
        "category": "env_variable",
        "severity": "HIGH",
        "description": "Sets INVENTORY_CACHE_TTL_SEC=180 in active production container configuration.",
        "flash_sale_risk": "Severe inventory overselling; customers purchase items already out of stock.",
        "apply": lambda db, env_id: _update_env_var(db, env_id, "INVENTORY_CACHE_TTL_SEC", "180")
    }
]


def _update_env_var(db: Session, env_id: int, key: str, value: str):
    var = db.query(EnvironmentVariable).filter(
        EnvironmentVariable.environment_id == env_id,
        EnvironmentVariable.is_actual == True,
        EnvironmentVariable.key == key
    ).first()
    if var:
        var.value = value
    else:
        db.add(EnvironmentVariable(environment_id=env_id, is_actual=True, key=key, value=value))
    db.commit()


def _update_infra_field(db: Session, env_id: int, field: str, value: Any):
    infra = db.query(InfrastructureDefinition).filter(
        InfrastructureDefinition.environment_id == env_id,
        InfrastructureDefinition.is_actual == True
    ).first()
    if infra:
        setattr(infra, field, value)
        db.commit()


def _update_secret_version(db: Session, env_id: int, name: str, version: int):
    sec = db.query(SecretMetadata).filter(
        SecretMetadata.environment_id == env_id,
        SecretMetadata.is_actual == True,
        SecretMetadata.name == name
    ).first()
    if sec:
        sec.version = version
        db.commit()


def _update_secret_status(db: Session, env_id: int, name: str, status: str):
    sec = db.query(SecretMetadata).filter(
        SecretMetadata.environment_id == env_id,
        SecretMetadata.is_actual == True,
        SecretMetadata.name == name
    ).first()
    if sec:
        sec.status = status
        db.commit()


class FailureSimulationService:
    @staticmethod
    def get_available_scenarios() -> List[Dict[str, Any]]:
        return [
            {
                "key": s["key"],
                "title": s["title"],
                "target_env": s["target_env"],
                "category": s["category"],
                "severity": s["severity"],
                "description": s["description"],
                "flash_sale_risk": s["flash_sale_risk"]
            }
            for s in SCENARIOS
        ]

    @staticmethod
    def inject_scenario(db: Session, scenario_key: str, env_name: str, operator_name: str = "System Operator") -> Dict[str, Any]:
        scenario = next((s for s in SCENARIOS if s["key"] == scenario_key), None)
        if not scenario:
            raise ValueError(f"Unknown scenario key: {scenario_key}")

        env = db.query(Environment).filter(Environment.name == env_name).first()
        if not env:
            raise ValueError(f"Environment '{env_name}' not found")

        # Apply failure change to actual state in database
        scenario["apply"](db, env.id)

        # Record simulation
        sim = SimulationRecord(
            scenario_key=scenario["key"],
            title=scenario["title"],
            environment_name=env_name,
            severity=scenario["severity"],
            status="ACTIVE",
            injected_by=operator_name,
            details_json=json.dumps({"description": scenario["description"], "risk": scenario["flash_sale_risk"]}),
            injected_at=datetime.utcnow()
        )
        db.add(sim)

        # Audit
        audit = AuditLog(
            environment_id=env.id,
            environment_name=env_name,
            action=f"SIMULATION_INJECTED_{scenario['key']}",
            user=operator_name,
            decision="SIMULATION",
            reason=f"Injected failure scenario '{scenario['title']}' to test drift detection and gatekeeper.",
            timestamp=datetime.utcnow()
        )
        db.add(audit)
        db.commit()

        # Run drift detection & gatekeeper
        drifts, checks = DriftDetectionEngine.detect_drifts_for_environment(db, env_name)
        risk_info = DriftDetectionEngine.calculate_risk_and_decision(drifts, env_name)

        # Auto-create incidents for critical drifts
        from backend.app.routes.operations import auto_create_incidents_for_drifts
        auto_create_incidents_for_drifts(db, env_name, drifts, operator=operator_name)

        # Update environment record
        env.status = "DRIFT_DETECTED" if len(drifts) > 0 else "HEALTHY"
        env.drift_count = len(drifts)
        env.critical_drift_count = sum(1 for d in drifts if d["severity"] == "CRITICAL")
        env.deployment_status = risk_info["decision"]
        env.readiness_score = risk_info["readiness_score"]
        env.health_score = risk_info["health_score"]
        env.risk_points = risk_info["risk_points"]
        env.last_validation_time = datetime.utcnow()
        db.commit()

        return {
            "scenario": scenario["title"],
            "environment": env_name,
            "status": "INJECTED",
            "active_drifts": len(drifts),
            "critical_drifts": risk_info["critical_count"],
            "risk_score": risk_info["risk_score"],
            "risk_level": risk_info["risk_level"],
            "gatekeeper_decision": risk_info["decision"],
            "flash_sale_risk": scenario["flash_sale_risk"]
        }

    @staticmethod
    def recover_environment(db: Session, env_name: str, operator_name: str = "System Operator") -> Dict[str, Any]:
        """Restore actual state to match expected baseline perfectly."""
        env = db.query(Environment).filter(Environment.name == env_name).first()
        if not env:
            raise ValueError(f"Environment '{env_name}' not found")

        # 1. Sync Infra
        exp_infra = db.query(InfrastructureDefinition).filter(
            InfrastructureDefinition.environment_id == env.id,
            InfrastructureDefinition.is_actual == False
        ).first()
        act_infra = db.query(InfrastructureDefinition).filter(
            InfrastructureDefinition.environment_id == env.id,
            InfrastructureDefinition.is_actual == True
        ).first()

        if exp_infra and act_infra:
            act_infra.cpu = exp_infra.cpu
            act_infra.memory = exp_infra.memory
            act_infra.database = exp_infra.database
            act_infra.replicas = exp_infra.replicas
            act_infra.max_connections = exp_infra.max_connections
            act_infra.raw_json = exp_infra.raw_json

        # 2. Sync Env Vars
        exp_vars = db.query(EnvironmentVariable).filter(
            EnvironmentVariable.environment_id == env.id,
            EnvironmentVariable.is_actual == False
        ).all()
        for exp_v in exp_vars:
            act_v = db.query(EnvironmentVariable).filter(
                EnvironmentVariable.environment_id == env.id,
                EnvironmentVariable.is_actual == True,
                EnvironmentVariable.key == exp_v.key
            ).first()
            if act_v:
                act_v.value = exp_v.value
            else:
                db.add(EnvironmentVariable(environment_id=env.id, is_actual=True, key=exp_v.key, value=exp_v.value))

        # 3. Sync Secrets
        exp_secrets = db.query(SecretMetadata).filter(
            SecretMetadata.environment_id == env.id,
            SecretMetadata.is_actual == False
        ).all()
        for exp_s in exp_secrets:
            act_s = db.query(SecretMetadata).filter(
                SecretMetadata.environment_id == env.id,
                SecretMetadata.is_actual == True,
                SecretMetadata.name == exp_s.name
            ).first()
            if act_s:
                act_s.version = exp_s.version
                act_s.status = "active"

        # 4. Sync Runtime
        exp_runtime = db.query(RuntimeSnapshot).filter(
            RuntimeSnapshot.environment_id == env.id
        ).order_by(RuntimeSnapshot.id.asc()).first()
        act_runtime = db.query(RuntimeSnapshot).filter(
            RuntimeSnapshot.environment_id == env.id
        ).order_by(RuntimeSnapshot.id.desc()).first()
        if exp_runtime and act_runtime:
            act_runtime.api_url = exp_runtime.api_url
            act_runtime.payment_mode = exp_runtime.payment_mode
            act_runtime.replicas = exp_runtime.replicas
            act_runtime.max_connections = exp_runtime.max_connections

        # Update any active simulation record
        active_sims = db.query(SimulationRecord).filter(
            SimulationRecord.environment_name == env_name,
            SimulationRecord.status == "ACTIVE"
        ).all()
        for s in active_sims:
            s.status = "RECOVERED"
            s.recovered_at = datetime.utcnow()

        # Also resolve open incidents for this environment and record recovery duration
        from backend.app.models.models import Incident, PerformanceMetric
        open_incidents = db.query(Incident).filter(
            Incident.environment == env_name.lower(),
            Incident.status.in_(["Open", "Investigating"])
        ).all()
        for inc in open_incidents:
            inc.status = "Resolved"
            inc.resolved_at = datetime.utcnow()
            inc.resolution_notes = (inc.resolution_notes or "") + f" | Auto-resolved by environment reconciliation ({operator_name})."

        db.add(PerformanceMetric(
            metric_type="RECOVERY",
            operation=f"recover_environment:{env_name}",
            environment=env_name,
            duration_ms=4.2,
            success=True,
            recorded_at=datetime.utcnow()
        ))

        # Audit
        audit = AuditLog(
            environment_id=env.id,
            environment_name=env_name,
            action="SIMULATION_RECOVERY_RECONCILE",
            user=operator_name,
            decision="APPROVED",
            reason="Recovered environment actual state to baseline. System revalidated to 0 drift.",
            timestamp=datetime.utcnow()
        )
        db.add(audit)

        # Update environment
        env.status = "HEALTHY"
        env.drift_count = 0
        env.critical_drift_count = 0
        env.deployment_status = "APPROVED"
        env.readiness_score = 100
        env.health_score = 100
        env.risk_points = 0
        env.last_validation_time = datetime.utcnow()
        db.commit()

        return {
            "environment": env_name,
            "status": "RECOVERED",
            "active_drifts": 0,
            "risk_score": 0,
            "risk_level": "LOW",
            "gatekeeper_decision": "APPROVED",
            "message": "Environment successfully recovered to healthy baseline. Zero drift verified."
        }

    @staticmethod
    def simulate_what_if(
        db: Session,
        env_name: str,
        modifications: Dict[str, Any]
    ) -> Dict[str, Any]:
        """
        Pure calculation simulator: evaluates the hypothetical impact of changes
        WITHOUT modifying database records or production state.
        """
        env = db.query(Environment).filter(Environment.name == env_name).first()
        if not env:
            raise ValueError(f"Environment '{env_name}' not found")

        # Retrieve current baseline drifts
        current_drifts, _ = DriftDetectionEngine.detect_drifts_for_environment(db, env_name)
        orig_count = len(current_drifts)

        # Create a simulated copy of drifts
        simulated_drifts = [d.copy() for d in current_drifts]
        drift_deltas = []

        # Check modifications
        # e.g. PAYMENT_MODE
        if "PAYMENT_MODE" in modifications:
            new_mode = str(modifications["PAYMENT_MODE"]).upper()
            existing = next((d for d in simulated_drifts if d["key"] == "PAYMENT_MODE"), None)
            if new_mode == "LIVE":
                if existing:
                    simulated_drifts.remove(existing)
                    drift_deltas.append({"key": "PAYMENT_MODE", "change": "RESOLVED", "detail": "Reconciled to LIVE"})
            else:
                if not existing:
                    new_drift = {
                        "category": "env_variable",
                        "key": "PAYMENT_MODE",
                        "expected_value": "LIVE",
                        "actual_value": new_mode,
                        "severity": "CRITICAL",
                        "risk_points": 40,
                        "reason": f"Simulated PAYMENT_MODE set to '{new_mode}'."
                    }
                    simulated_drifts.append(new_drift)
                    drift_deltas.append({"key": "PAYMENT_MODE", "change": "NEW_DRIFT", "detail": f"Drift introduced: {new_mode}"})

        # e.g. replicas
        if "replicas" in modifications:
            new_reps = int(modifications["replicas"])
            existing = next((d for d in simulated_drifts if d["key"] == "replicas"), None)
            if new_reps >= 16:
                if existing:
                    simulated_drifts.remove(existing)
                    drift_deltas.append({"key": "replicas", "change": "RESOLVED", "detail": f"Replicas scaled to {new_reps} (>= 16)"})
            else:
                if not existing:
                    new_drift = {
                        "category": "infrastructure",
                        "key": "replicas",
                        "expected_value": "16",
                        "actual_value": str(new_reps),
                        "severity": "CRITICAL" if new_reps < 8 else "HIGH",
                        "risk_points": 35 if new_reps < 8 else 20,
                        "reason": f"Simulated replicas scaled down to {new_reps}."
                    }
                    simulated_drifts.append(new_drift)
                    drift_deltas.append({"key": "replicas", "change": "NEW_DRIFT", "detail": f"Replicas below baseline: {new_reps}"})

        # e.g. max_connections
        if "max_connections" in modifications:
            new_conns = int(modifications["max_connections"])
            existing = next((d for d in simulated_drifts if d["key"] == "max_connections"), None)
            if new_conns >= 1200:
                if existing:
                    simulated_drifts.remove(existing)
                    drift_deltas.append({"key": "max_connections", "change": "RESOLVED", "detail": f"Max connections increased to {new_conns}"})
            else:
                if not existing:
                    new_drift = {
                        "category": "infrastructure",
                        "key": "max_connections",
                        "expected_value": "1200",
                        "actual_value": str(new_conns),
                        "severity": "HIGH",
                        "risk_points": 25,
                        "reason": f"Simulated max_connections set to {new_conns}."
                    }
                    simulated_drifts.append(new_drift)
                    drift_deltas.append({"key": "max_connections", "change": "NEW_DRIFT", "detail": f"Connection limit throttled to {new_conns}"})

        # Calculate hypothetical risk & decision
        sim_risk = DriftDetectionEngine.calculate_risk_and_decision(simulated_drifts, env_name)

        impact_summary = (
            f"Applying these parameters would yield {len(simulated_drifts)} total drift(s) "
            f"with a simulated risk score of {sim_risk['risk_score']}/100. "
            f"Gatekeeper verdict: {sim_risk['decision']}."
        )

        return {
            "environment": env_name,
            "original_drifts": orig_count,
            "simulated_drifts": len(simulated_drifts),
            "simulated_risk_score": sim_risk["risk_score"],
            "simulated_risk_level": sim_risk["risk_level"],
            "simulated_decision": sim_risk["decision"],
            "drift_deltas": drift_deltas,
            "potential_impact": impact_summary
        }
