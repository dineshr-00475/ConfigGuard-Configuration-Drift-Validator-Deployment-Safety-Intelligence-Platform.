import uuid
import pytest
from fastapi.testclient import TestClient
from backend.app.main import app

client = TestClient(app)


def test_dashboard_metrics():
    """Verify dynamic dashboard metrics computed from database."""
    res = client.get("/api/dashboard/metrics")
    assert res.status_code == 200
    data = res.json()
    assert data["total_environments"] >= 3
    assert data["total_drifts"] >= 0
    assert "severity_distribution" in data
    assert "environment_health" in data
    assert "drift_trends" in data
    assert len(data["environment_health"]) >= 3


def test_validation_run_production():
    """Test full validation run on production environment."""
    res = client.post("/api/validation/run/production")
    assert res.status_code == 200
    data = res.json()
    assert data["environment_name"] == "production"
    assert "readiness_score" in data
    assert "health_score" in data
    assert "deployment_decision" in data
    assert "drifts" in data
    assert "fingerprint_expected" in data
    assert "fingerprint_actual" in data
    assert data["fingerprint_expected"].startswith("CFG-EXP-")
    assert data["fingerprint_actual"].startswith("CFG-ACT-")


def test_fingerprint_endpoint():
    """Test SHA-256 fingerprint retrieval."""
    res = client.get("/api/validation/fingerprint/production")
    assert res.status_code == 200
    data = res.json()
    assert "expected_fingerprint" in data
    assert "actual_fingerprint" in data
    assert "components" in data


def test_root_cause_analysis():
    """Test automated multi-factor root cause analysis."""
    res = client.get("/api/validation/root-cause/production")
    assert res.status_code == 200
    data = res.json()
    assert data["environment"] == "production"
    assert "root_cause" in data
    assert "evidence" in data
    assert "recommended_fix" in data
    assert data["confidence_level"] in ["HIGH", "MEDIUM", "LOW"]


def test_production_safety_score():
    """Test production safety score with category breakdown."""
    res = client.get("/api/validation/safety-score/production")
    assert res.status_code == 200
    data = res.json()
    assert data["environment"] == "production"
    assert 0 <= data["overall_score"] <= 100
    assert 0 <= data["infrastructure_score"] <= 100
    assert 0 <= data["env_vars_score"] <= 100
    assert 0 <= data["secrets_score"] <= 100
    assert 0 <= data["runtime_score"] <= 100


def test_dependency_impact_graph():
    """Test dynamic dependency graph and blast radius calculation."""
    res = client.get("/api/dependencies/graph/production")
    assert res.status_code == 200
    data = res.json()
    assert data["environment"] == "production"
    assert len(data["nodes"]) >= 8
    assert len(data["edges"]) >= 7
    assert "blast_radius" in data


def test_what_if_simulator():
    """Test what-if simulation without mutating database."""
    res = client.post("/api/simulation/what-if", json={
        "environment": "production",
        "modifications": {
            "PAYMENT_MODE": "LIVE",
            "replicas": 20,
            "max_connections": 1500
        }
    })
    assert res.status_code == 200
    data = res.json()
    assert data["environment"] == "production"
    assert "simulated_risk_score" in data
    assert "simulated_decision" in data
    assert "drift_deltas" in data


def test_failure_simulation_injection_and_recovery():
    """Test injecting failure scenario and recovering back to baseline."""
    # 1. List scenarios
    scenarios_res = client.get("/api/simulation/scenarios")
    assert scenarios_res.status_code == 200
    scenarios = scenarios_res.json()
    assert len(scenarios) >= 5

    # 2. Inject WRONG_PAYMENT_MODE
    inject_res = client.post("/api/simulation/inject", json={
        "scenario_key": "WRONG_PAYMENT_MODE",
        "environment": "production"
    })
    assert inject_res.status_code == 200
    inj_data = inject_res.json()
    assert inj_data["status"] == "INJECTED"
    assert inj_data["gatekeeper_decision"] == "BLOCKED"

    # 3. Recover environment
    recover_res = client.post("/api/simulation/recover/production")
    assert recover_res.status_code == 200
    rec_data = recover_res.json()
    assert rec_data["status"] == "RECOVERED"
    assert rec_data["active_drifts"] == 0
    assert rec_data["gatekeeper_decision"] == "APPROVED"


def test_reconcile_all_drifts():
    """Test full environment reconciliation to 0 drift."""
    res = client.post("/api/validation/reconcile-all/production")
    assert res.status_code == 200
    data = res.json()
    assert data["drift_count"] == 0
    assert data["deployment_decision"] == "APPROVED"
    assert data["readiness_score"] == 100
    assert data["fingerprint_expected"].replace("EXP", "ACT") == data["fingerprint_actual"]


def test_event_safety_idempotency_and_out_of_order():
    """Test event engine: idempotency duplicate detection and stale version rejection."""
    unique_id = f"EVT-TEST-{uuid.uuid4().hex[:8]}"
    stale_id = f"EVT-STALE-{uuid.uuid4().hex[:8]}"
    curr_env = client.get("/api/environments/development").json()
    curr_ver = curr_env.get("config_version", 1)
    adv_ver = curr_ver + 50

    # Event 1: Normal advancement
    e1 = client.post("/api/events", json={
        "event_id": unique_id,
        "environment": "development",
        "event_type": "DEPLOY_START",
        "version": adv_ver,
        "payload": {"initiator": "ci-agent"}
    })
    assert e1.status_code == 200
    assert e1.json()["status"] == "PROCESSED"

    # Duplicate Event 1: Should trigger idempotency barrier
    e1_dup = client.post("/api/events", json={
        "event_id": unique_id,
        "environment": "development",
        "event_type": "DEPLOY_START",
        "version": adv_ver,
        "payload": {"initiator": "ci-agent"}
    })
    assert e1_dup.status_code == 200
    assert e1_dup.json()["status"] == "IGNORED_DUPLICATE"

    # Stale/Out-of-order Event: Version is < adv_ver
    e_stale = client.post("/api/events", json={
        "event_id": stale_id,
        "environment": "development",
        "event_type": "CONFIG_UPDATE",
        "version": adv_ver - 10,
        "payload": {"initiator": "old-pipeline"}
    })
    assert e_stale.status_code == 200
    assert e_stale.json()["status"] == "REJECTED_OLD_VERSION"


def test_benchmark_experiment_execution():
    """Test live 100+ scenario benchmark comparing Baseline vs ConfigGuard."""
    res = client.post("/api/experiments/benchmark/run", json={"total_scenarios": 100})
    assert res.status_code == 200
    data = res.json()
    assert data["total_scenarios"] >= 100
    assert data["configguard_detection_rate"] > data["baseline_detection_rate"]
    assert data["configguard_detected"] > 0
    assert len(data["scenarios"]) >= 100


def test_deployment_monitor():
    """Test real-time deployment monitor endpoint."""
    res = client.get("/api/deployments/monitor/production")
    assert res.status_code == 200
    data = res.json()
    assert data["environment"] == "production"
    assert "steps" in data
    assert len(data["steps"]) >= 7


def test_notifications_lifecycle():
    """Test notifications retrieval and marking as read."""
    # List notifications
    res = client.get("/api/notifications")
    assert res.status_code == 200
    notes = res.json()
    assert isinstance(notes, list)

    # Clear all
    clear_res = client.post("/api/notifications/clear")
    assert clear_res.status_code == 200
    assert clear_res.json()["message"] == "All notifications marked as read"
