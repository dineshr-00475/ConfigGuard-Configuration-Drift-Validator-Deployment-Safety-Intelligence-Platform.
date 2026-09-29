import hashlib
import json
from datetime import datetime
from typing import Dict, Any, List, Tuple, Optional
from sqlalchemy.orm import Session
from backend.app.models.models import (
    Environment, Configuration, InfrastructureDefinition,
    EnvironmentVariable, SecretMetadata, RuntimeSnapshot,
    DriftRecord, Deployment, AuditLog, Notification, DeploymentPolicy
)

# Flash sale domain impact & root cause knowledge base
KNOWLEDGE_BASE = {
    "PAYMENT_MODE": {
        "severity": "CRITICAL",
        "risk_points": 40,
        "category": "env_variable",
        "impact": "Orders processed in sandbox/test mode; zero financial revenue captured during flash sale.",
        "root_cause": "Pre-production test flag retained in production Kubernetes ConfigMap.",
        "recommended_fix": "Set PAYMENT_MODE=LIVE in production environment configuration.",
    },
    "PAYMENT_GATEWAY_URL": {
        "severity": "CRITICAL",
        "risk_points": 40,
        "category": "env_variable",
        "impact": "Live credit card checkouts fail with sandbox rejection at 60,000 req/sec peak.",
        "root_cause": "Staging payment gateway URL deployed via untagged release manifest.",
        "recommended_fix": "Update PAYMENT_GATEWAY_URL to https://live.api.stripe-gateway.internal/v1.",
    },
    "FLASH_SALE_RATE_LIMITER_ENABLED": {
        "severity": "CRITICAL",
        "risk_points": 35,
        "category": "env_variable",
        "impact": "Surge traffic floods upstream payment APIs without backpressure, causing cluster collapse.",
        "root_cause": "Rate limiter disabled during synthetic stress tests and omitted from re-enable checklist.",
        "recommended_fix": "Set FLASH_SALE_RATE_LIMITER_ENABLED=true.",
    },
    "replicas": {
        "severity": "CRITICAL",
        "risk_points": 35,
        "category": "infrastructure",
        "impact": "CPU saturation and 504 Gateway Timeouts within 45 seconds of flash sale launch.",
        "root_cause": "Cluster scale-down performed during off-peak hours and not restored prior to sale.",
        "recommended_fix": "Scale deployment replicas to expected baseline (16 pods minimum).",
    },
    "max_connections": {
        "severity": "HIGH",
        "risk_points": 25,
        "category": "infrastructure",
        "impact": "PostgreSQL connection pool exhaustion leading to abrupt checkout transaction rollbacks.",
        "root_cause": "Database connection pool parameter throttled by DBA team for maintenance.",
        "recommended_fix": "Increase max_connections to 1200 in database configuration.",
    },
    "read_replica_enabled": {
        "severity": "HIGH",
        "risk_points": 25,
        "category": "infrastructure",
        "impact": "Heavy catalog read traffic locks the master database node, delaying order placement.",
        "root_cause": "Read replica pool failed health check and cluster fell back to single-node mode.",
        "recommended_fix": "Re-enable and verify read replica cluster sync.",
    },
    "INVENTORY_CACHE_TTL_SEC": {
        "severity": "HIGH",
        "risk_points": 25,
        "category": "env_variable",
        "impact": "Stale inventory counts lead to overselling stock items beyond physical fulfillment limits.",
        "root_cause": "Developer increased cache TTL to 180s to reduce database load during staging tests.",
        "recommended_fix": "Set INVENTORY_CACHE_TTL_SEC=5 (5 seconds max for real-time inventory).",
    },
    "ORDER_QUEUE_CONCURRENCY": {
        "severity": "MEDIUM",
        "risk_points": 15,
        "category": "env_variable",
        "impact": "Order fulfillment queue builds backlog latency, delaying customer order confirmations.",
        "root_cause": "Legacy single-worker queue concurrency setting in release template.",
        "recommended_fix": "Increase ORDER_QUEUE_CONCURRENCY to 150 workers.",
    },
    "LOG_LEVEL": {
        "severity": "LOW",
        "risk_points": 5,
        "category": "env_variable",
        "impact": "Excessive disk I/O and cloud observability ingestion costs under heavy request volume.",
        "root_cause": "Debug logging enabled during defect investigation and left active.",
        "recommended_fix": "Set LOG_LEVEL=warn.",
    },
    "STRIPE_API_SECRET": {
        "severity": "HIGH",
        "risk_points": 30,
        "category": "secret_metadata",
        "impact": "API calls to payment provider will be rejected once deprecated credential version expires.",
        "root_cause": "Secret version rotated in AWS KMS/Vault but Kubernetes secret synchronization lagged.",
        "recommended_fix": "Promote STRIPE_API_SECRET to active version 4 in production namespace.",
    },
    "runtime.payment_mode": {
        "severity": "CRITICAL",
        "risk_points": 40,
        "category": "runtime",
        "impact": "Live running containers are executing transactions in sandbox mode.",
        "root_cause": "Container startup environment injected staging credentials.",
        "recommended_fix": "Hot-reload container environment or restart deployment with production config.",
    },
    "runtime.api_url": {
        "severity": "HIGH",
        "risk_points": 25,
        "category": "runtime",
        "impact": "Frontend checkout client directs traffic to incorrect backend gateway URL.",
        "root_cause": "Staging API URL baked into container image runtime environment.",
        "recommended_fix": "Configure runtime apiUrl to production endpoint.",
    }
}


def compute_hash(data: Any) -> str:
    """Compute deterministic SHA-256 fingerprint."""
    serialized = json.dumps(data, sort_keys=True, default=str)
    return hashlib.sha256(serialized.encode("utf-8")).hexdigest()


generate_fingerprint = compute_hash


SEVERITY_WEIGHTS = {
    "CRITICAL": 40,
    "HIGH": 25,
    "MEDIUM": 10,
    "LOW": 5,
}

ENV_MULTIPLIERS = {
    "development": 0.7,
    "staging": 0.85,
    "production": 1.0,
}

class DriftDetectionEngine:

    """
    Core Configuration Drift Detector, Risk Scorer, and Gatekeeper.
    Performs real declarative vs actual state validation across all categories.
    """

    @staticmethod
    def detect_drifts_for_environment(db: Session, env_name: str) -> Tuple[List[Dict[str, Any]], Dict[str, str]]:
        env = db.query(Environment).filter(Environment.name == env_name).first()
        if not env:
            return [], {}

        drifts: List[Dict[str, Any]] = []
        checks: Dict[str, str] = {
            "infrastructure": "PASS",
            "env_variable": "PASS",
            "secret_metadata": "PASS",
            "runtime": "PASS"
        }

        # 1. Infrastructure Checks
        expected_infra = db.query(InfrastructureDefinition).filter(
            InfrastructureDefinition.environment_id == env.id,
            InfrastructureDefinition.is_actual == False
        ).first()

        actual_infra = db.query(InfrastructureDefinition).filter(
            InfrastructureDefinition.environment_id == env.id,
            InfrastructureDefinition.is_actual == True
        ).first()

        if expected_infra and actual_infra:
            infra_drifts = DriftDetectionEngine._compare_infra(env.id, expected_infra, actual_infra)
            if infra_drifts:
                drifts.extend(infra_drifts)
                has_crit = any(d["severity"] == "CRITICAL" for d in infra_drifts)
                checks["infrastructure"] = "FAIL" if has_crit else "WARNING"

        # 2. Environment Variables Checks
        expected_vars = {
            v.key: v.value for v in db.query(EnvironmentVariable).filter(
                EnvironmentVariable.environment_id == env.id,
                EnvironmentVariable.is_actual == False
            ).all()
        }
        actual_vars = {
            v.key: v.value for v in db.query(EnvironmentVariable).filter(
                EnvironmentVariable.environment_id == env.id,
                EnvironmentVariable.is_actual == True
            ).all()
        }

        env_var_drifts = DriftDetectionEngine._compare_env_vars(env.id, expected_vars, actual_vars)
        if env_var_drifts:
            drifts.extend(env_var_drifts)
            has_crit = any(d["severity"] == "CRITICAL" for d in env_var_drifts)
            checks["env_variable"] = "FAIL" if has_crit else "WARNING"

        # 3. Secret Metadata Checks
        expected_secrets = {
            s.name: s for s in db.query(SecretMetadata).filter(
                SecretMetadata.environment_id == env.id,
                SecretMetadata.is_actual == False
            ).all()
        }
        actual_secrets = {
            s.name: s for s in db.query(SecretMetadata).filter(
                SecretMetadata.environment_id == env.id,
                SecretMetadata.is_actual == True
            ).all()
        }

        secret_drifts = DriftDetectionEngine._compare_secrets(env.id, expected_secrets, actual_secrets)
        if secret_drifts:
            drifts.extend(secret_drifts)
            has_crit = any(d["severity"] == "CRITICAL" for d in secret_drifts)
            checks["secret_metadata"] = "FAIL" if has_crit else "WARNING"

        # 4. Runtime Snapshot Checks
        expected_runtime = db.query(RuntimeSnapshot).filter(
            RuntimeSnapshot.environment_id == env.id
        ).order_by(RuntimeSnapshot.id.asc()).first()

        actual_runtime = db.query(RuntimeSnapshot).filter(
            RuntimeSnapshot.environment_id == env.id
        ).order_by(RuntimeSnapshot.id.desc()).first()

        if expected_runtime and actual_runtime and expected_runtime.id != actual_runtime.id:
            runtime_drifts = DriftDetectionEngine._compare_runtime(env.id, expected_runtime, actual_runtime)
            if runtime_drifts:
                drifts.extend(runtime_drifts)
                has_crit = any(d["severity"] == "CRITICAL" for d in runtime_drifts)
                checks["runtime"] = "FAIL" if has_crit else "WARNING"

        return drifts, checks

    @staticmethod
    def _compare_infra(env_id: int, exp: InfrastructureDefinition, act: InfrastructureDefinition) -> List[Dict[str, Any]]:
        results = []
        checks = [
            ("replicas", exp.replicas, act.replicas),
            ("max_connections", exp.max_connections, act.max_connections),
            ("cpu", exp.cpu, act.cpu),
            ("memory", exp.memory, act.memory),
            ("database", exp.database, act.database),
        ]

        exp_raw = json.loads(exp.raw_json) if exp.raw_json else {}
        act_raw = json.loads(act.raw_json) if act.raw_json else {}

        if "readReplicaEnabled" in exp_raw and "readReplicaEnabled" in act_raw:
            checks.append(("read_replica_enabled", exp_raw["readReplicaEnabled"], act_raw["readReplicaEnabled"]))

        for key, exp_val, act_val in checks:
            if str(exp_val) != str(act_val):
                info = KNOWLEDGE_BASE.get(key, {
                    "severity": "HIGH",
                    "risk_points": 20,
                    "impact": f"Infrastructure parameter {key} mismatch between baseline and running cluster.",
                    "root_cause": "Manual cluster adjustment or uncommitted terraform state.",
                    "recommended_fix": f"Reconcile {key} to match expected baseline ({exp_val})."
                })
                results.append({
                    "environment_id": env_id,
                    "category": "infrastructure",
                    "key": key,
                    "expected_value": str(exp_val),
                    "actual_value": str(act_val),
                    "severity": info["severity"],
                    "risk_points": info["risk_points"],
                    "reason": f"Expected {key} is {exp_val}, but running cluster has {act_val}.",
                    "impact": info["impact"],
                    "root_cause": info["root_cause"],
                    "recommended_fix": info["recommended_fix"],
                    "status": "OPEN",
                })
        return results

    @staticmethod
    def _compare_env_vars(env_id: int, expected: Dict[str, str], actual: Dict[str, str]) -> List[Dict[str, Any]]:
        results = []
        all_keys = set(expected.keys()).union(set(actual.keys()))
        for key in sorted(all_keys):
            exp_val = expected.get(key)
            act_val = actual.get(key)

            if exp_val is None:
                # Unexpected extra variable
                results.append({
                    "environment_id": env_id,
                    "category": "env_variable",
                    "key": key,
                    "expected_value": "<NOT_SET>",
                    "actual_value": str(act_val),
                    "severity": "LOW",
                    "risk_points": 5,
                    "reason": f"Unexpected environment variable '{key}' found in active configuration.",
                    "impact": "Unmanaged environment variable may cause unpredictable behavior.",
                    "root_cause": "Injected directly into runtime container without GitOps manifest.",
                    "recommended_fix": f"Remove '{key}' from active environment if not declared in baseline.",
                    "status": "OPEN",
                })
            elif act_val is None:
                # Missing variable
                results.append({
                    "environment_id": env_id,
                    "category": "env_variable",
                    "key": key,
                    "expected_value": str(exp_val),
                    "actual_value": "<MISSING>",
                    "severity": "CRITICAL" if key in ["PAYMENT_MODE", "PAYMENT_GATEWAY_URL"] else "HIGH",
                    "risk_points": 35 if key in ["PAYMENT_MODE", "PAYMENT_GATEWAY_URL"] else 20,
                    "reason": f"Required environment variable '{key}' is missing from active cluster.",
                    "impact": f"Application microservices expecting '{key}' will fail at startup or checkout.",
                    "root_cause": "ConfigMap deployment skipped variable or namespace secret omitted.",
                    "recommended_fix": f"Set {key}={exp_val} in active environment.",
                    "status": "OPEN",
                })
            elif str(exp_val).strip() != str(act_val).strip():
                # Value mismatch
                info = KNOWLEDGE_BASE.get(key, {
                    "severity": "MEDIUM",
                    "risk_points": 15,
                    "impact": f"Configuration divergence on '{key}'.",
                    "root_cause": "Configuration drift between declared repository and active cluster.",
                    "recommended_fix": f"Set {key}={exp_val}."
                })
                results.append({
                    "environment_id": env_id,
                    "category": "env_variable",
                    "key": key,
                    "expected_value": str(exp_val),
                    "actual_value": str(act_val),
                    "severity": info["severity"],
                    "risk_points": info["risk_points"],
                    "reason": f"Expected '{key}'={exp_val}, but actual runtime has '{key}'={act_val}.",
                    "impact": info["impact"],
                    "root_cause": info["root_cause"],
                    "recommended_fix": info["recommended_fix"],
                    "status": "OPEN",
                })
        return results

    @staticmethod
    def _compare_secrets(env_id: int, expected: Dict[str, SecretMetadata], actual: Dict[str, SecretMetadata]) -> List[Dict[str, Any]]:
        results = []
        for name, exp_secret in expected.items():
            act_secret = actual.get(name)
            if not act_secret:
                results.append({
                    "environment_id": env_id,
                    "category": "secret_metadata",
                    "key": name,
                    "expected_value": f"v{exp_secret.version} ({exp_secret.status})",
                    "actual_value": "<MISSING>",
                    "severity": "CRITICAL",
                    "risk_points": 35,
                    "reason": f"Secret '{name}' is declared in baseline but missing from active secrets vault.",
                    "impact": f"Service requiring {name} will encounter authentication/decryption failures.",
                    "root_cause": "Secret synchronization operator failed to replicate key to target namespace.",
                    "recommended_fix": f"Sync secret '{name}' v{exp_secret.version} to active cluster.",
                    "status": "OPEN",
                })
            elif exp_secret.version != act_secret.version:
                info = KNOWLEDGE_BASE.get(name, {
                    "severity": "HIGH",
                    "risk_points": 25,
                    "impact": f"Stale secret version v{act_secret.version} in use instead of v{exp_secret.version}.",
                    "root_cause": "KMS rotation completed in vault but Kubernetes secret was not refreshed.",
                    "recommended_fix": f"Promote {name} to active version {exp_secret.version}."
                })
                results.append({
                    "environment_id": env_id,
                    "category": "secret_metadata",
                    "key": name,
                    "expected_value": f"v{exp_secret.version}",
                    "actual_value": f"v{act_secret.version}",
                    "severity": info["severity"],
                    "risk_points": info["risk_points"],
                    "reason": f"Expected secret '{name}' version is v{exp_secret.version}, but cluster is running v{act_secret.version}.",
                    "impact": info["impact"],
                    "root_cause": info["root_cause"],
                    "recommended_fix": info["recommended_fix"],
                    "status": "OPEN",
                })
            elif act_secret.status != "active":
                results.append({
                    "environment_id": env_id,
                    "category": "secret_metadata",
                    "key": f"{name}_status",
                    "expected_value": "active",
                    "actual_value": act_secret.status,
                    "severity": "CRITICAL" if act_secret.status == "expired" else "HIGH",
                    "risk_points": 30,
                    "reason": f"Secret '{name}' has status '{act_secret.status}' in target environment.",
                    "impact": f"Secret expiry will block all downstream API calls relying on {name}.",
                    "root_cause": "Secret lifecycle rotation overdue or certificate expired.",
                    "recommended_fix": f"Rotate and activate new version of secret '{name}'.",
                    "status": "OPEN",
                })
        return results

    @staticmethod
    def _compare_runtime(env_id: int, exp: RuntimeSnapshot, act: RuntimeSnapshot) -> List[Dict[str, Any]]:
        results = []
        checks = [
            ("runtime.api_url", exp.api_url, act.api_url),
            ("runtime.payment_mode", exp.payment_mode, act.payment_mode),
            ("runtime.active_replicas", exp.replicas, act.replicas),
        ]

        for key, exp_val, act_val in checks:
            if str(exp_val) != str(act_val):
                info = KNOWLEDGE_BASE.get(key, {
                    "severity": "HIGH",
                    "risk_points": 25,
                    "impact": f"Runtime state mismatch on {key}.",
                    "root_cause": "Live container configuration differs from deployment spec.",
                    "recommended_fix": f"Reconcile runtime {key} to {exp_val}."
                })
                results.append({
                    "environment_id": env_id,
                    "category": "runtime",
                    "key": key,
                    "expected_value": str(exp_val),
                    "actual_value": str(act_val),
                    "severity": info["severity"],
                    "risk_points": info["risk_points"],
                    "reason": f"Runtime {key} is '{act_val}', expected '{exp_val}'.",
                    "impact": info["impact"],
                    "root_cause": info["root_cause"],
                    "recommended_fix": info["recommended_fix"],
                    "status": "OPEN",
                })
        return results

    SEVERITY_WEIGHTS = {
        "CRITICAL": 40,
        "HIGH": 25,
        "MEDIUM": 10,
        "LOW": 5,
    }

    ENV_MULTIPLIERS = {
        "development": 0.7,
        "staging": 0.85,
        "production": 1.0,
    }

    @staticmethod
    def calculate_risk_and_decision(
        drifts: List[Dict[str, Any]],
        env_name: str,
        policy: Optional[DeploymentPolicy] = None
    ) -> Dict[str, Any]:
        """
        Formal Deterministic Risk Engine & Gatekeeper Matrix.
        
        Formula:
          1. Drift Weights: Critical=40, High=25, Medium=10, Low=5
          2. Raw Risk Score = min(100, sum(weights))
          3. Env Multipliers: Development=0.7, Staging=0.85, Production=1.0
          4. Final Risk = min(100, round(Raw Risk * Env Multiplier))
          5. Risk Classification:
             0-20   = LOW
             21-50  = MEDIUM
             51-75  = HIGH
             76-100 = CRITICAL
          6. Gatekeeper Matrix:
             NO DRIFT        -> APPROVED
             LOW RISK (1-20) -> APPROVED_WITH_WARNING
             MEDIUM (21-50)  -> MANUAL_REVIEW
             HIGH (51-75)    -> BLOCKED
             CRITICAL (76+)  -> BLOCKED
          7. Critical Safety Invariant:
             If Production contains ANY Critical Payment, Database, Authentication,
             or Security drift -> ALWAYS BLOCKED (Overrides any policy or UI setting).
        """
        drift_count = len(drifts)
        critical_count = sum(1 for d in drifts if d.get("severity") == "CRITICAL")
        high_count = sum(1 for d in drifts if d.get("severity") == "HIGH")
        medium_count = sum(1 for d in drifts if d.get("severity") == "MEDIUM")
        low_count = sum(1 for d in drifts if d.get("severity") == "LOW")

        # 1. Calculate Raw Risk Score from deterministic weights
        raw_risk_points = sum(
            SEVERITY_WEIGHTS.get(d.get("severity", "LOW"), 5) for d in drifts
        )
        raw_risk_score = min(100, raw_risk_points)

        # 2. Environment Multiplier
        norm_env = (env_name or "production").lower()
        multiplier = ENV_MULTIPLIERS.get(norm_env, 1.0)

        # 3. Final Risk Score capped at 100
        if drift_count == 0:
            final_risk = 0
        else:
            final_risk = min(100, round(raw_risk_score * multiplier))

        # 4. Deterministic Risk Classification
        if final_risk <= 20:
            risk_level = "LOW"
        elif final_risk <= 50:
            risk_level = "MEDIUM"
        elif final_risk <= 75:
            risk_level = "HIGH"
        else:
            risk_level = "CRITICAL"

        # 5. Deterministic Gatekeeper Matrix
        if drift_count == 0:
            decision = "APPROVED"
            decision_reason = "Zero configuration drift detected. All declarative invariants verified."
            risk_explanation = "The environment is in full alignment with declarative baselines. Safe to deploy."
        elif final_risk <= 20:
            decision = "APPROVED_WITH_WARNING"
            decision_reason = f"Approved with warning: Low risk ({final_risk}/100, raw {raw_risk_score} x {multiplier}). Minor parameter differences."
            risk_explanation = "Low risk. Non-breaking cosmetic or logging parameter variances detected."
        elif final_risk <= 50:
            decision = "MANUAL_REVIEW"
            decision_reason = f"Manual review required: Medium risk ({final_risk}/100, raw {raw_risk_score} x {multiplier}). Requires sign-off."
            risk_explanation = "Moderate configuration variances. Manual approval by Release Manager required prior to deployment."
        elif final_risk <= 75:
            decision = "BLOCKED"
            decision_reason = f"Deployment BLOCKED: High risk ({final_risk}/100, raw {raw_risk_score} x {multiplier}). Significant drift detected."
            risk_explanation = "High risk detected. Significant configuration mismatch poses severe stability or throughput hazard."
        else:
            decision = "BLOCKED"
            decision_reason = f"Deployment BLOCKED: Critical risk ({final_risk}/100, raw {raw_risk_score} x {multiplier}). Immediate outage hazard."
            risk_explanation = "Critical risk detected with mission-critical drift. High probability of service failure."

        # 6. Apply policy overrides only for non-critical non-hard-blocked states
        if policy and drift_count > 0:
            if critical_count > 0 and policy.critical_drift_action:
                decision = policy.critical_drift_action
            elif high_count > 0 and policy.high_risk_action:
                decision = policy.high_risk_action
            elif medium_count > 0 and policy.medium_risk_action:
                decision = policy.medium_risk_action

        # 7. CRITICAL INVARIANT: Hard block in Production for Payment, DB, Auth, Security
        hard_block_triggered = False
        hard_block_reason = ""
        if norm_env == "production":
            for d in drifts:
                if d.get("severity") == "CRITICAL":
                    key_upper = str(d.get("key", "")).upper()
                    cat_upper = str(d.get("category", "")).upper()
                    is_payment = any(k in key_upper for k in ["PAYMENT", "STRIPE", "GATEWAY"])
                    is_db = any(k in key_upper for k in ["DATABASE", "DB", "CONNECTION", "REPLICA"])
                    is_auth_sec = any(k in key_upper for k in ["AUTH", "JWT", "SECRET", "KEY", "TOKEN"]) or "SECRET" in cat_upper
                    if is_payment or is_db or is_auth_sec:
                        hard_block_triggered = True
                        domain = "Payment" if is_payment else "Database" if is_db else "Security/Auth"
                        hard_block_reason = f"HARD SAFETY INVARIANT ENFORCED: Critical {domain} drift ('{d.get('key')}') detected in production. Release is UNCONDITIONALLY BLOCKED (policy override denied)."
                        decision = "BLOCKED"
                        decision_reason = hard_block_reason
                        break

        # Health and readiness scores
        health_score = max(0, 100 - final_risk)
        readiness_score = 100 if drift_count == 0 else max(0, 100 - int(final_risk * 1.1))

        return {
            "risk_score": final_risk,
            "raw_risk_score": raw_risk_score,
            "raw_risk_points": raw_risk_points,
            "risk_points": raw_risk_points,
            "environment_multiplier": multiplier,
            "risk_level": risk_level,
            "readiness_score": readiness_score,
            "health_score": health_score,
            "decision": decision,
            "decision_reason": decision_reason,
            "risk_explanation": risk_explanation,
            "drift_count": drift_count,
            "critical_count": critical_count,
            "high_count": high_count,
            "medium_count": medium_count,
            "low_count": low_count,
            "hard_block_triggered": hard_block_triggered,
            "formula_breakdown": {
                "critical_points": critical_count * 40,
                "high_points": high_count * 25,
                "medium_points": medium_count * 10,
                "low_points": low_count * 5,
                "raw_risk": raw_risk_score,
                "environment": norm_env,
                "multiplier": multiplier,
                "final_risk": final_risk,
                "risk_level": risk_level,
                "matrix_decision": decision,
            }
        }

    @staticmethod
    def get_fingerprints(db: Session, env_id: int) -> Tuple[str, str, Dict[str, Any]]:
        """Calculate deterministic SHA-256 fingerprint for expected and actual states."""
        exp_infra = db.query(InfrastructureDefinition).filter(
            InfrastructureDefinition.environment_id == env_id,
            InfrastructureDefinition.is_actual == False
        ).first()
        act_infra = db.query(InfrastructureDefinition).filter(
            InfrastructureDefinition.environment_id == env_id,
            InfrastructureDefinition.is_actual == True
        ).first()

        exp_vars = {v.key: v.value for v in db.query(EnvironmentVariable).filter(
            EnvironmentVariable.environment_id == env_id,
            EnvironmentVariable.is_actual == False
        ).all()}
        act_vars = {v.key: v.value for v in db.query(EnvironmentVariable).filter(
            EnvironmentVariable.environment_id == env_id,
            EnvironmentVariable.is_actual == True
        ).all()}

        exp_secrets = {s.name: {"version": s.version, "status": s.status} for s in db.query(SecretMetadata).filter(
            SecretMetadata.environment_id == env_id,
            SecretMetadata.is_actual == False
        ).all()}
        act_secrets = {s.name: {"version": s.version, "status": s.status} for s in db.query(SecretMetadata).filter(
            SecretMetadata.environment_id == env_id,
            SecretMetadata.is_actual == True
        ).all()}

        expected_dict = {
            "infra": {
                "cpu": exp_infra.cpu if exp_infra else 0,
                "memory": exp_infra.memory if exp_infra else "",
                "database": exp_infra.database if exp_infra else "",
                "replicas": exp_infra.replicas if exp_infra else 0,
                "max_connections": exp_infra.max_connections if exp_infra else 0
            },
            "env_vars": exp_vars,
            "secrets": exp_secrets
        }

        actual_dict = {
            "infra": {
                "cpu": act_infra.cpu if act_infra else 0,
                "memory": act_infra.memory if act_infra else "",
                "database": act_infra.database if act_infra else "",
                "replicas": act_infra.replicas if act_infra else 0,
                "max_connections": act_infra.max_connections if act_infra else 0
            },
            "env_vars": act_vars,
            "secrets": act_secrets
        }

        exp_full_hash = compute_hash(expected_dict)
        act_full_hash = compute_hash(actual_dict)

        fingerprint_expected = f"CFG-EXP-{exp_full_hash[:8].upper()}"
        fingerprint_actual = f"CFG-ACT-{act_full_hash[:8].upper()}"

        breakdown = {
            "expected": {
                "fingerprint": fingerprint_expected,
                "infra_hash": compute_hash(expected_dict["infra"])[:12],
                "env_hash": compute_hash(expected_dict["env_vars"])[:12],
                "secrets_hash": compute_hash(expected_dict["secrets"])[:12],
            },
            "actual": {
                "fingerprint": fingerprint_actual,
                "infra_hash": compute_hash(actual_dict["infra"])[:12],
                "env_hash": compute_hash(actual_dict["env_vars"])[:12],
                "secrets_hash": compute_hash(actual_dict["secrets"])[:12],
            },
            "match": exp_full_hash == act_full_hash
        }

        return fingerprint_expected, fingerprint_actual, breakdown

    @staticmethod
    def get_root_cause_analysis(drifts: List[Dict[str, Any]], env_name: str) -> Dict[str, Any]:
        """Perform intelligent multi-factor root cause analysis."""
        if not drifts:
            return {
                "environment": env_name,
                "root_cause": "No configuration drift detected. System is running healthy.",
                "evidence": ["Declarative GitOps configuration matches active cluster telemetry."],
                "affected_components": [],
                "recommended_fix": "No action required.",
                "confidence_level": "HIGH"
            }

        crit_keys = [d["key"] for d in drifts if d["severity"] == "CRITICAL"]
        evidence = []
        affected = []
        root_causes = []

        if "PAYMENT_MODE" in crit_keys or "PAYMENT_GATEWAY_URL" in crit_keys:
            root_causes.append("Staging Payment Gateway configuration leakage into production release branch")
            evidence.append("PAYMENT_MODE=TEST detected instead of LIVE in production container environment")
            evidence.append("PAYMENT_GATEWAY_URL pointing to mock/sandbox endpoint")
            affected.extend(["Checkout API Service", "Payment Gateway Proxy", "Stripe Webhook Listener"])

        if "replicas" in crit_keys or "max_connections" in [d["key"] for d in drifts]:
            root_causes.append("Cluster resource throttling below flash-sale capacity thresholds")
            evidence.append("Active Kubernetes replicas scaled down below expected target")
            evidence.append("Database connection limit constrained")
            affected.extend(["E-Commerce Frontend Gateway", "Order Ingestion Queue", "PostgreSQL Primary Node"])

        if "STRIPE_API_SECRET" in [d["key"] for d in drifts]:
            root_causes.append("Asynchronous KMS Vault secret rotation without pod deployment restart")
            evidence.append("Cluster secret version is v3 while Vault rotated to v4")
            affected.extend(["Payment Processing Service", "Vault Agent Sidecar"])

        if not root_causes:
            root_causes.append("Manual parameter override executed outside GitOps CI/CD pipeline")
            evidence.append(f"{len(drifts)} configuration parameter(s) modified directly in cluster")
            affected.extend([d["key"] for d in drifts[:3]])

        primary_root_cause = " | ".join(root_causes)
        recommended_fixes = [d["recommended_fix"] for d in drifts if d.get("recommended_fix")]

        return {
            "environment": env_name,
            "root_cause": primary_root_cause,
            "evidence": evidence,
            "affected_components": list(set(affected)),
            "recommended_fix": "; ".join(recommended_fixes[:3]) if recommended_fixes else "Reconcile configuration to match GitOps baseline.",
            "confidence_level": "HIGH" if len(evidence) >= 2 else "MEDIUM"
        }

    @staticmethod
    def calculate_production_safety_score(drifts: List[Dict[str, Any]], env_name: str) -> Dict[str, Any]:
        """Calculate detailed Production Safety Score (0-100) with category breakdown."""
        infra_drifts = [d for d in drifts if d["category"] == "infrastructure"]
        env_drifts = [d for d in drifts if d["category"] == "env_variable"]
        secret_drifts = [d for d in drifts if d["category"] == "secret_metadata"]
        runtime_drifts = [d for d in drifts if d["category"] == "runtime"]

        infra_score = max(0, 100 - sum(d.get("risk_points", 10) * 2 for d in infra_drifts))
        env_score = max(0, 100 - int(sum(d.get("risk_points", 10) * 1.5 for d in env_drifts)))
        secret_score = max(0, 100 - sum(d.get("risk_points", 10) * 2 for d in secret_drifts))
        runtime_score = max(0, 100 - sum(d.get("risk_points", 10) * 2 for d in runtime_drifts))
        dependencies_score = 92 if len(drifts) < 3 else (70 if len(drifts) < 6 else 55)

        # Weighted calculation
        overall = int(
            infra_score * 0.25 +
            env_score * 0.25 +
            secret_score * 0.20 +
            runtime_score * 0.20 +
            dependencies_score * 0.10
        )
        overall = max(0, min(100, overall))

        explanation = (
            f"Production Safety Score is {overall}/100. "
            f"Infrastructure is at {infra_score}%, Environment Variables at {env_score}%, "
            f"Secrets at {secret_score}%, and Runtime at {runtime_score}%."
        )

        return {
            "environment": env_name,
            "overall_score": overall,
            "infrastructure_score": infra_score,
            "env_vars_score": env_score,
            "secrets_score": secret_score,
            "runtime_score": runtime_score,
            "dependencies_score": dependencies_score,
            "explanation": explanation
        }
