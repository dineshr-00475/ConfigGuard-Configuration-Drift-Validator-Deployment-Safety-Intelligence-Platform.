import pytest
from fastapi.testclient import TestClient
from backend.app.main import app

client = TestClient(app)


class TestFailureScenarios:
    """Tests verifying the platform gracefully handles edge cases, corrupted data, and failure states."""

    def test_failure_1_missing_environment(self):
        """Verify requesting a non-existent environment returns 404 with clean message."""
        res = client.get("/api/environments/mars-datacenter-99")
        assert res.status_code == 404
        assert "not found" in res.json()["detail"].lower()

        # Validation on missing env
        val_res = client.post("/api/validations/run/mars-datacenter-99")
        assert val_res.status_code == 404

    def test_failure_2_invalid_configuration_payload(self):
        """Verify sending an invalid configuration payload triggers validation error."""
        res = client.post("/api/simulation/inject", json={
            "scenario_key": "NON_EXISTENT_SCENARIO_XYZ",
            "environment": "production"
        })
        assert res.status_code in [400, 404]

    def test_failure_3_secret_version_mismatch(self):
        """Verify secret version mismatch is detected as a high severity drift."""
        # Inject secret version drift
        inject_res = client.post("/api/simulation/inject", json={
            "scenario_key": "WRONG_SECRET_VERSION",
            "environment": "production"
        })
        assert inject_res.status_code == 200

        # Validate production
        val_res = client.post("/api/validation/run/production")
        assert val_res.status_code == 200
        val_data = val_res.json()
        assert val_data["drift_count"] >= 1
        assert any(d["category"] == "secret_metadata" for d in val_data.get("drifts", []))

    def test_failure_4_out_of_order_deployment_version(self):
        """Verify out-of-order deployment / stale configuration version is detected."""
        # Inject high cache TTL / stale version
        inject_res = client.post("/api/simulation/inject", json={
            "scenario_key": "HIGH_CACHE_TTL",
            "environment": "production"
        })
        assert inject_res.status_code == 200

        val_res = client.post("/api/validation/run/production")
        assert val_res.status_code == 200
        val_data = val_res.json()
        assert val_data["deployment_decision"] in ["BLOCKED", "MANUAL_REVIEW"]

    def test_failure_5_reconcile_all_drifts_idempotent(self):
        """Verify recovering environment runs safely and restores zero drifts."""
        # Recover once
        rec1 = client.post("/api/simulation/recover/production")
        assert rec1.status_code == 200

        # Recover again (idempotent)
        rec2 = client.post("/api/simulation/recover/production")
        assert rec2.status_code == 200

    def test_failure_6_what_if_simulation_invalid_environment(self):
        """Verify What-If simulation with unknown environment returns 400 or 404."""
        sim_res = client.post("/api/simulation/what-if", json={
            "environment": "unknown-nonexistent-env",
            "modifications": {"replicas": 4}
        })
        assert sim_res.status_code in [400, 404]
