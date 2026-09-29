import pytest
from fastapi.testclient import TestClient
from backend.app.main import app

client = TestClient(app)


class TestIntegrationWorkflows:
    """Real end-to-end integration workflow tests validating the full lifecycle."""

    def test_workflow_1_create_config_and_validate(self):
        """Workflow 1: Fetch Configuration -> Run validation -> Verify expected result."""
        # 1. Fetch current configuration for production
        cfg_res = client.get("/api/configurations/production")
        assert cfg_res.status_code == 200
        cfg_data = cfg_res.json()
        assert "version" in cfg_data

        # 2. Trigger validation run
        val_res = client.post("/api/validation/run/production")
        assert val_res.status_code == 200
        val_data = val_res.json()
        assert "deployment_decision" in val_data
        assert "risk_points" in val_data
        assert "readiness_score" in val_data
        assert "health_score" in val_data
        assert "checks" in val_data

    def test_workflow_2_inject_drift_and_verify_blocked(self):
        """Workflow 2: Inject Drift -> Validate -> Detect Drift -> Block Deployment."""
        # Inject critical payment drift into production
        inject_res = client.post("/api/simulation/inject", json={
            "scenario_key": "WRONG_PAYMENT_MODE",
            "environment": "production"
        })
        assert inject_res.status_code == 200

        # Validate production environment
        val_res = client.post("/api/validation/run/production")
        assert val_res.status_code == 200
        val_data = val_res.json()
        assert val_data["deployment_decision"] == "BLOCKED"
        assert val_data["drift_count"] >= 1
        assert val_data["critical_count"] >= 1

    def test_workflow_3_reconcile_drift_and_verify_approved(self):
        """Workflow 3: Recover Drift -> Validate -> Approve Deployment."""
        # Recover all drifts in production
        rec_res = client.post("/api/simulation/recover/production")
        assert rec_res.status_code == 200

        # Verify deployment validation is now APPROVED
        val_res = client.post("/api/validation/run/production")
        assert val_res.status_code == 200
        val_data = val_res.json()
        assert val_data["deployment_decision"] == "APPROVED"
        assert val_data["risk_points"] == 0
        assert val_data["drift_count"] == 0

    def test_workflow_4_create_deployment_creates_audit_log(self):
        """Workflow 4: Trigger validation -> Verify Audit Log and Deployment records are created."""
        val_res = client.post("/api/validation/run/production")
        assert val_res.status_code == 200

        # Verify deployments list
        dep_res = client.get("/api/deployments")
        assert dep_res.status_code == 200
        deps = dep_res.json()
        assert len(deps) > 0

        # Verify audit logs
        audit_res = client.get("/api/audit-logs")
        assert audit_res.status_code == 200
        audit_logs = audit_res.json()
        assert len(audit_logs) > 0

    def test_workflow_5_fetch_fleet_risk_metrics(self):
        """Workflow 5: Fetch Fleet Risk Metrics -> Compare with calculated aggregates."""
        metrics_res = client.get("/api/dashboard/metrics")
        assert metrics_res.status_code == 200
        metrics = metrics_res.json()
        assert "total_environments" in metrics
        assert metrics["total_environments"] >= 3
        assert "fleet_risk_score" in metrics
        assert "production_safety_score" in metrics
        assert "deployment_decisions" in metrics

    def test_workflow_6_gatekeeper_decision_matches_risk_score(self):
        """Workflow 6: Verify Gatekeeper Decision Strictly Matches Risk Score."""
        mon_res = client.get("/api/deployments/monitor/production")
        assert mon_res.status_code == 200
        mon_data = mon_res.json()
        assert "overall_status" in mon_data
        assert "risk_score" in mon_data
        risk_score = mon_data["risk_score"]
        decision = mon_data["overall_status"]

        if risk_score == 0:
            assert decision == "APPROVED"
        elif risk_score <= 20:
            assert decision == "APPROVED_WITH_WARNING"
        elif risk_score <= 50:
            assert decision == "MANUAL_REVIEW"
        else:
            assert decision == "BLOCKED"

    def test_workflow_7_benchmark_execution_and_persistence(self):
        """Workflow 7: Run live 100+ scenario benchmark through API and verify persistence."""
        bench_res = client.post("/api/experiments/benchmark/run", json={"total_scenarios": 100})
        assert bench_res.status_code == 200
        bench_data = bench_res.json()
        assert bench_data["total_scenarios"] >= 100
        assert bench_data["configguard_detection_rate"] > bench_data["baseline_detection_rate"]
        assert len(bench_data["scenarios"]) >= 100

        # Query latest benchmark API
        latest_res = client.get("/api/experiments/benchmark/latest")
        assert latest_res.status_code == 200
        latest_data = latest_res.json()
        assert latest_data["total_scenarios"] >= 100

        # Query benchmark runs list
        runs_res = client.get("/api/experiments/benchmark/runs")
        assert runs_res.status_code == 200
        runs = runs_res.json()
        assert len(runs) >= 1
        assert "run_name" in runs[0]

        # Query benchmark run details by id
        first_id = runs[0]["id"]
        detail_res = client.get(f"/api/experiments/benchmark/runs/{first_id}")
        assert detail_res.status_code == 200
        detail_data = detail_res.json()
        assert len(detail_data["scenarios"]) >= 100
        assert "expected_failure" in detail_data["scenarios"][0]
        assert "configguard_result" in detail_data["scenarios"][0]
