import pytest
from backend.app.services.drift_engine import DriftDetectionEngine, SEVERITY_WEIGHTS, ENV_MULTIPLIERS, generate_fingerprint
from backend.app.services.benchmark_engine import BaselineValidator, ConfigGuardValidator, BenchmarkScenarioGenerator
from backend.app.models.models import DeploymentPolicy


class TestUnitRiskEngine:
    """Comprehensive unit test suite for ConfigGuard deterministic risk formulation and gatekeeper matrix."""

    def test_severity_weights_constant(self):
        """Verify formal deterministic weights: Critical=40, High=25, Medium=10, Low=5."""
        assert SEVERITY_WEIGHTS["CRITICAL"] == 40
        assert SEVERITY_WEIGHTS["HIGH"] == 25
        assert SEVERITY_WEIGHTS["MEDIUM"] == 10
        assert SEVERITY_WEIGHTS["LOW"] == 5

    def test_environment_multipliers_constant(self):
        """Verify formal environment multipliers: Development=0.7, Staging=0.85, Production=1.0."""
        assert ENV_MULTIPLIERS["development"] == 0.7
        assert ENV_MULTIPLIERS["staging"] == 0.85
        assert ENV_MULTIPLIERS["production"] == 1.0

    def test_hash_generation_determinism(self):
        """Verify fingerprint generation is strictly deterministic and invariant to dictionary key ordering."""
        dict_a = {"replicas": 16, "cpu": 8, "region": "us-east-1"}
        dict_b = {"region": "us-east-1", "replicas": 16, "cpu": 8}
        dict_c = {"replicas": 15, "cpu": 8, "region": "us-east-1"}

        hash_a = generate_fingerprint(dict_a)
        hash_b = generate_fingerprint(dict_b)
        hash_c = generate_fingerprint(dict_c)

        assert hash_a == hash_b, "Identical dictionary with different key ordering must produce identical hash"
        assert hash_a != hash_c, "Modified values must produce completely different hash"
        assert len(hash_a) == 64, "Fingerprint must be standard 256-bit hex (64 chars)"

    def test_risk_calculation_zero_drift(self):
        """Verify zero drift yields Risk=0, Level=LOW, Decision=APPROVED, Health=100, Readiness=100."""
        res = DriftDetectionEngine.calculate_risk_and_decision([], "production")
        assert res["risk_score"] == 0
        assert res["raw_risk_score"] == 0
        assert res["risk_level"] == "LOW"
        assert res["decision"] == "APPROVED"
        assert res["health_score"] == 100
        assert res["readiness_score"] == 100
        assert res["hard_block_triggered"] is False

    def test_risk_calculation_low_risk_cosmetic(self):
        """Verify Low drift (1-20 points) -> APPROVED_WITH_WARNING."""
        drifts = [{"key": "LOG_LEVEL", "severity": "LOW", "category": "env_variable"}]
        res = DriftDetectionEngine.calculate_risk_and_decision(drifts, "production")
        assert res["raw_risk_score"] == 5
        assert res["risk_score"] == 5
        assert res["risk_level"] == "LOW"
        assert res["decision"] == "APPROVED_WITH_WARNING"
        assert res["health_score"] == 95

    def test_risk_calculation_medium_risk_manual_review(self):
        """Verify Medium drift (21-50 points) -> MANUAL_REVIEW."""
        # 3 medium drifts = 3 * 10 = 30 points
        drifts = [
            {"key": "ORDER_QUEUE_CONCURRENCY", "severity": "MEDIUM", "category": "env_variable"},
            {"key": "WORKER_THREADS", "severity": "MEDIUM", "category": "infrastructure"},
            {"key": "BUFFER_SIZE", "severity": "MEDIUM", "category": "infrastructure"},
        ]
        res = DriftDetectionEngine.calculate_risk_and_decision(drifts, "production")
        assert res["raw_risk_score"] == 30
        assert res["risk_score"] == 30
        assert res["risk_level"] == "MEDIUM"
        assert res["decision"] == "MANUAL_REVIEW"

    def test_risk_calculation_high_risk_blocked(self):
        """Verify High drift (51-75 points) -> BLOCKED."""
        # 2 high drifts + 1 low = 25 + 25 + 5 = 55 points
        drifts = [
            {"key": "INVENTORY_CACHE_TTL_SEC", "severity": "HIGH", "category": "env_variable"},
            {"key": "cpu_cores", "severity": "HIGH", "category": "infrastructure"},
            {"key": "LOG_LEVEL", "severity": "LOW", "category": "env_variable"},
        ]
        res = DriftDetectionEngine.calculate_risk_and_decision(drifts, "production")
        assert res["raw_risk_score"] == 55
        assert res["risk_score"] == 55
        assert res["risk_level"] == "HIGH"
        assert res["decision"] == "BLOCKED"

    def test_risk_calculation_critical_risk_blocked(self):
        """Verify Critical drift (76-100 points) -> BLOCKED."""
        # 2 critical drifts = 40 + 40 = 80 points
        drifts = [
            {"key": "PAYMENT_MODE", "severity": "CRITICAL", "category": "env_variable"},
            {"key": "FLASH_SALE_RATE_LIMITER_ENABLED", "severity": "CRITICAL", "category": "env_variable"},
        ]
        res = DriftDetectionEngine.calculate_risk_and_decision(drifts, "production")
        assert res["raw_risk_score"] == 80
        assert res["risk_score"] == 80
        assert res["risk_level"] == "CRITICAL"
        assert res["decision"] == "BLOCKED"

    def test_environment_multipliers_applied_correctly(self):
        """Verify raw risk is multiplied by env multiplier: 0.7 for Dev, 0.85 for Staging, 1.0 for Prod."""
        # 1 High drift (25 points)
        drifts = [{"key": "INVENTORY_CACHE_TTL_SEC", "severity": "HIGH", "category": "env_variable"}]

        # Production: 25 * 1.0 = 25
        prod_res = DriftDetectionEngine.calculate_risk_and_decision(drifts, "production")
        assert prod_res["risk_score"] == 25
        assert prod_res["environment_multiplier"] == 1.0

        # Staging: 25 * 0.85 = 21.25 -> round = 21
        staging_res = DriftDetectionEngine.calculate_risk_and_decision(drifts, "staging")
        assert staging_res["risk_score"] == 21
        assert staging_res["environment_multiplier"] == 0.85

        # Development: 25 * 0.7 = 17.5 -> round = 18
        dev_res = DriftDetectionEngine.calculate_risk_and_decision(drifts, "development")
        assert dev_res["risk_score"] == 18
        assert dev_res["environment_multiplier"] == 0.7
        # Notice in Dev, score 18 is classified as LOW (<=20), so verdict is APPROVED_WITH_WARNING
        assert dev_res["decision"] == "APPROVED_WITH_WARNING"

    def test_production_payment_critical_drift_rule_always_blocks(self):
        """
        Verify the Hard Safety Invariant:
        If Production contains ANY Critical Payment, Database, Authentication, or Security drift:
        -> Release is UNCONDITIONALLY BLOCKED.
        Custom policy overrides MUST be rejected.
        """
        drifts = [{"key": "PAYMENT_MODE", "severity": "CRITICAL", "category": "env_variable"}]
        
        # Create a loose policy that attempts to auto-approve everything
        loose_policy = DeploymentPolicy(
            environment="production",
            critical_drift_action="AUTO_APPROVE",
            high_risk_action="AUTO_APPROVE",
            medium_risk_action="AUTO_APPROVE",
        )

        res = DriftDetectionEngine.calculate_risk_and_decision(drifts, "production", loose_policy)
        assert res["decision"] == "BLOCKED", "Critical payment drift in production MUST be BLOCKED even if policy says AUTO_APPROVE"
        assert res["hard_block_triggered"] is True
        assert "HARD SAFETY INVARIANT ENFORCED" in res["decision_reason"]

    def test_production_database_critical_drift_always_blocks(self):
        """Verify Critical Database drift in production triggers hard safety invariant block."""
        drifts = [{"key": "database_type", "severity": "CRITICAL", "category": "infrastructure"}]
        loose_policy = DeploymentPolicy(
            environment="production",
            critical_drift_action="AUTO_APPROVE"
        )
        res = DriftDetectionEngine.calculate_risk_and_decision(drifts, "production", loose_policy)
        assert res["decision"] == "BLOCKED"
        assert res["hard_block_triggered"] is True

    def test_production_security_secret_critical_drift_always_blocks(self):
        """Verify Critical Security/Secret drift in production triggers hard safety invariant block."""
        drifts = [{"key": "STRIPE_API_SECRET", "severity": "CRITICAL", "category": "secret_metadata"}]
        loose_policy = DeploymentPolicy(
            environment="production",
            critical_drift_action="AUTO_APPROVE"
        )
        res = DriftDetectionEngine.calculate_risk_and_decision(drifts, "production", loose_policy)
        assert res["decision"] == "BLOCKED"
        assert res["hard_block_triggered"] is True

    def test_baseline_validator_misses_subtle_drifts(self):
        """Verify Baseline Validator misses subtle semantic drifts (e.g. sandbox payment flag when container is alive)."""
        scenario = {
            "container_running": True,
            "config_file_exists": True,
            "config_syntax_valid": True,
            "expected_env_vars": {"PAYMENT_MODE": "LIVE"},
            "actual_env_vars": {"PAYMENT_MODE": "SANDBOX"}
        }
        b_res = BaselineValidator.validate(scenario)
        assert b_res["detected"] is False
        assert b_res["result"] == "MISSED"

    def test_configguard_validator_catches_subtle_drifts(self):
        """Verify ConfigGuard Validator detects semantic payment drift and blocks release."""
        scenario = {
            "environment": "production",
            "container_running": True,
            "config_file_exists": True,
            "config_syntax_valid": True,
            "expected_env_vars": {"PAYMENT_MODE": "LIVE"},
            "actual_env_vars": {"PAYMENT_MODE": "SANDBOX"}
        }
        cg_res = ConfigGuardValidator.validate(scenario)
        assert cg_res["detected"] is True
        assert cg_res["result"] == "DETECTED"
        assert cg_res["severity"] == "CRITICAL"
        assert cg_res["decision"] == "BLOCKED"
        assert cg_res["risk_score"] >= 40
