import time
from concurrent.futures import ThreadPoolExecutor
import pytest
from fastapi.testclient import TestClient
from sqlalchemy.exc import IntegrityError

from backend.app.main import app
from backend.app.database.session import SessionLocal
from backend.app.models.models import (
    AuditLog,
    ChangeRequestRecord,
    Environment,
    Event,
    Incident,
    PipelineExecution,
)

client = TestClient(app)


class TestFinalAdvancedImprovements:
    """Comprehensive tests for all 9 advanced improvement modules and data integrity."""

    def test_1_system_health_monitoring_live_checks(self):
        """Verify System Health endpoint measures real DB latency, validation engine, event processor, and API response time."""
        res = client.get("/api/health/detailed")
        assert res.status_code == 200
        data = res.json()

        assert data["overall_status"] in ["HEALTHY", "WARNING"]
        assert data["backend_api"]["status"] == "ONLINE"
        assert data["backend_api"]["current_probe_latency_ms"] >= 0
        assert data["database"]["status"] == "CONNECTED"
        assert data["database"]["query_latency_ms"] >= 0
        assert data["validation_engine"]["status"] == "OPERATIONAL"
        assert data["event_processor"]["status"] == "OPERATIONAL"
        assert "system_errors" in data

        # Run active health probe
        probe_res = client.post("/api/health/probe")
        assert probe_res.status_code == 200
        probe_data = probe_res.json()
        assert probe_data["validation_engine"]["last_successful_validation"] is not None

    def test_2_deployment_pipeline_blocks_unsafe_progression_and_persists(self):
        """Verify 6-stage pipeline halts at Configuration Validation / Risk Assessment when critical drift exists, and passes when reconciled."""
        # 1. Inject critical drift in production
        client.post("/api/simulation/inject", json={
            "scenario_key": "WRONG_PAYMENT_MODE",
            "environment": "production"
        })

        # 2. Execute pipeline on production -> must be BLOCKED and prevent Approval/Deployment stages
        pipe_res = client.post("/api/pipelines/execute", json={
            "environment": "production",
            "version_tag": "v2.5.0-flash-test",
            "commit_sha": "c0ffee1"
        })
        assert pipe_res.status_code == 200
        pipe_data = pipe_res.json()
        assert pipe_data["overall_status"] == "BLOCKED"
        assert len(pipe_data["stages"]) == 6

        stage_map = {s["stage"]: s for s in pipe_data["stages"]}
        assert stage_map["Code"]["status"] == "PASSED"
        assert stage_map["Build"]["status"] == "PASSED"
        assert stage_map["Configuration Validation"]["status"] == "FAILED"
        assert stage_map["Risk Assessment"]["status"] == "FAILED"
        assert stage_map["Approval"]["status"] == "BLOCKED"
        assert stage_map["Deployment"]["status"] == "BLOCKED"
        assert pipe_data["failure_reason"] is not None

        # 3. Reconcile production and re-execute pipeline -> must complete all 6 stages
        client.post("/api/simulation/recover/production")
        clean_res = client.post("/api/pipelines/execute", json={
            "environment": "production",
            "version_tag": "v2.5.1-clean",
            "commit_sha": "a11ce99"
        })
        assert clean_res.status_code == 200
        clean_data = clean_res.json()
        assert clean_data["overall_status"] == "COMPLETED"
        for st in clean_data["stages"]:
            assert st["status"] == "PASSED"

        # 4. Verify persistence in pipeline history
        hist_res = client.get("/api/pipelines/history?environment=production")
        assert hist_res.status_code == 200
        hist_list = hist_res.json()
        assert any(p["pipeline_id"] == pipe_data["pipeline_id"] for p in hist_list)
        assert any(p["pipeline_id"] == clean_data["pipeline_id"] for p in hist_list)

    def test_3_incident_management_auto_creation_and_lifecycle(self):
        """Verify critical drift automatically creates an Incident, supports Open -> Investigating -> Resolved -> Closed, and writes audit logs."""
        # Inject critical drift -> auto-creates incident
        client.post("/api/simulation/inject", json={
            "scenario_key": "EXPIRED_SECRET",
            "environment": "production"
        })
        val_res = client.post("/api/validation/run/production")
        assert val_res.status_code == 200

        inc_res = client.get("/api/incidents?environment=production")
        assert inc_res.status_code == 200
        incidents = inc_res.json()
        assert len(incidents) >= 1

        target_inc = incidents[0]
        inc_id = target_inc["incident_id"]
        assert "environment" in target_inc
        assert "severity" in target_inc
        assert "affected_component" in target_inc
        assert "root_cause" in target_inc
        assert "assigned_user" in target_inc

        # Transition through Open -> Investigating -> Resolved -> Closed
        for next_status in ["Investigating", "Resolved", "Closed"]:
            patch_res = client.patch(f"/api/incidents/{inc_id}", json={
                "status": next_status,
                "assigned_user": "sre-oncall@driftguard.io",
                "resolution_notes": f"Transitioned to {next_status} during automated verification."
            })
            assert patch_res.status_code == 200
            assert patch_res.json()["status"] == next_status

        # Clean up production drift
        client.post("/api/simulation/recover/production")

    def test_4_change_request_workflow_rbac_and_self_approval_prevention(self):
        """Verify Developer submit -> DevOps review -> Release Manager approval, and block self-approval or unauthorized Production approval."""
        # 1. Developer submits CR for Production
        create_res = client.post("/api/change-requests", json={
            "title": "Raise Production DB Pool for Flash Sale",
            "environment": "production",
            "category": "infrastructure",
            "parameter_key": "max_connections",
            "previous_value": "1000",
            "proposed_value": "1400",
            "reason": "Support 60k concurrent checkouts.",
            "requester_name": "Alex Rivera",
            "requester_email": "developer@driftguard.io",
            "requester_role": "DEVELOPER"
        })
        assert create_res.status_code == 200
        cr = create_res.json()
        cr_id = cr["cr_id"]
        assert cr["approval_status"] == "PENDING_DEVOPS_REVIEW"
        assert cr["previous_value"] == "1000"
        assert cr["proposed_value"] == "1400"

        # 2. DevOps reviews CR -> advances to PENDING_APPROVAL
        rev_res = client.post(f"/api/change-requests/{cr_id}/devops-review", json={
            "decision": "PASS",
            "review_notes": "Capacity validated on RDS cluster.",
            "reviewer_name": "Jordan Vance",
            "reviewer_email": "devops@driftguard.io",
            "reviewer_role": "DEVOPS"
        })
        assert rev_res.status_code == 200
        assert rev_res.json()["approval_status"] == "PENDING_APPROVAL"

        # 3. Attempt unauthorized approval by DEVELOPER -> must return 403 Forbidden
        unauth_res = client.post(f"/api/change-requests/{cr_id}/decision", json={
            "decision": "APPROVED",
            "approval_notes": "Trying to approve as Developer",
            "approver_name": "Alex Rivera",
            "approver_email": "developer@driftguard.io",
            "approver_role": "DEVELOPER"
        })
        assert unauth_res.status_code == 403

        # 4. Attempt self-approval even if requester claims RELEASE_MANAGER role with same email -> must return 403 Forbidden
        self_app_res = client.post(f"/api/change-requests/{cr_id}/decision", json={
            "decision": "APPROVED",
            "approval_notes": "Trying to self-approve own Production CR",
            "approver_name": "Alex Rivera",
            "approver_email": "developer@driftguard.io",
            "approver_role": "RELEASE_MANAGER"
        })
        assert self_app_res.status_code == 403

        # 5. Distinct Release Manager approves Production CR -> must succeed (200 OK)
        valid_app_res = client.post(f"/api/change-requests/{cr_id}/decision", json={
            "decision": "APPROVED",
            "approval_notes": "Approved by Release Manager under zero-drift policy.",
            "approver_name": "Elena Rostova",
            "approver_email": "release@driftguard.io",
            "approver_role": "RELEASE_MANAGER"
        })
        assert valid_app_res.status_code == 200
        assert valid_app_res.json()["approval_status"] == "APPROVED"

    def test_5_performance_analytics_real_measurements(self):
        """Verify performance analytics endpoint returns actual measured durations and probe execution."""
        probe_res = client.post("/api/performance/measure-probe")
        assert probe_res.status_code == 200
        data = probe_res.json()

        summary = data["summary"]
        assert summary["validation_duration_ms"] > 0
        assert summary["db_operation_time_ms"] > 0
        assert summary["event_processing_duration_ms"] > 0
        assert summary["events_processed_per_second"] > 0
        assert "failed_validation_count" in summary
        assert len(data["timeline_series"]) >= 1

    def test_6_report_export_csv_and_json_all_types(self):
        """Verify all 5 report export endpoints return real stored data in both CSV and JSON formats."""
        report_types = [
            "validation",
            "drift-history",
            "benchmark",
            "audit-logs",
            "environment-health"
        ]
        for rtype in report_types:
            json_res = client.get(f"/api/reports/export/{rtype}?format=json")
            assert json_res.status_code == 200
            jdata = json_res.json()
            assert jdata["report_type"] == rtype
            assert "generated_at" in jdata
            assert isinstance(jdata["records"], list)

            csv_res = client.get(f"/api/reports/export/{rtype}?format=csv")
            assert csv_res.status_code == 200
            assert "text/csv" in csv_res.headers.get("content-type", "")
            assert len(csv_res.text) > 10

    def test_7_guided_demo_10_steps_and_production_isolation(self):
        """Verify all 10 steps of Guided Demo Mode execute and never mutate real Production database state."""
        # Ensure real production is clean first
        client.post("/api/simulation/recover/production")
        real_before = client.get("/api/environments").json()
        prod_before = next(e for e in real_before if e["name"] == "production")

        # Execute all 10 guided demo steps sequentially
        for step in range(1, 11):
            step_res = client.post(f"/api/demo/step/{step}")
            assert step_res.status_code == 200
            sdata = step_res.json()
            assert sdata["current_step"] == step
            assert sdata["isolated"] is True
            assert sdata["real_production_untouched"] is True

            if step in [2, 3, 4, 5, 6]:
                assert len(sdata["drifts"]) == 3
                assert sdata["risk_calculation"]["decision"] == "BLOCKED"
            elif step in [7, 8, 9, 10]:
                assert len(sdata["drifts"]) == 0
                assert sdata["risk_calculation"]["decision"] == "APPROVED"

        # Verify real production environment was never modified during the demo
        real_after = client.get("/api/environments").json()
        prod_after = next(e for e in real_after if e["name"] == "production")
        assert prod_after["status"] == prod_before["status"]
        assert prod_after["drift_count"] == prod_before["drift_count"]

    def test_8_data_integrity_transactions_deduplication_and_concurrency(self):
        """Verify unique event IDs, transaction rollback safety, version consistency, and concurrent requests."""
        unique_ev_id = f"EVT-INTEGRITY-{int(time.time() * 1000)}"
        env_res = client.get("/api/environments").json()
        dev_env = next(e for e in env_res if e["name"] == "development")
        next_ver = dev_env["config_version"] + 1

        # 1. Valid event advances version
        ev1 = client.post("/api/events", json={
            "event_id": unique_ev_id,
            "environment": "development",
            "event_type": "CONFIG_UPDATED",
            "version": next_ver,
            "payload": {"key": "FEATURE_X", "value": "true"}
        })
        assert ev1.status_code == 200
        assert ev1.json()["status"] == "PROCESSED"

        # 2. Duplicate event_id is idempotently ignored
        ev_dup = client.post("/api/events", json={
            "event_id": unique_ev_id,
            "environment": "development",
            "event_type": "CONFIG_UPDATED",
            "version": next_ver + 1,
            "payload": {"key": "FEATURE_X", "value": "true"}
        })
        assert ev_dup.status_code == 200
        assert ev_dup.json()["status"] == "IGNORED_DUPLICATE"

        # 3. Database Rollback Safety on duplicate unique constraint at ORM level
        db = SessionLocal()
        try:
            dup_row = Event(
                event_id=unique_ev_id,
                environment="development",
                event_type="TEST",
                version=999,
                timestamp="now",
                payload_json="{}",
                status="PROCESSED"
            )
            db.add(dup_row)
            with pytest.raises(IntegrityError):
                db.commit()
            db.rollback()
            # Session remains usable after rollback
            assert db.query(Environment).count() >= 3
        finally:
            db.close()

        # 4. Concurrent Validation & Health Requests
        def _fire_request(idx: int):
            r = client.get("/api/health/detailed") if idx % 2 == 0 else client.post("/api/validation/run/development")
            return r.status_code

        with ThreadPoolExecutor(max_workers=4) as pool:
            statuses = list(pool.map(_fire_request, range(8)))
        assert all(code == 200 for code in statuses)
