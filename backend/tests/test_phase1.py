import uuid
import pytest
from fastapi.testclient import TestClient
from backend.app.main import app

client = TestClient(app)


# 1. Health API Tests
def test_health_endpoint():
    response = client.get("/api/health")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] in ["healthy", "ok"]
    assert data["service"] == "Configuration-Drift Validator API"
    assert data["database"] == "connected"


def test_root_endpoint():
    response = client.get("/")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "online"
    assert data["health"] == "/api/health"


# 2. Environments API Tests
def test_list_environments():
    response = client.get("/api/environments")
    assert response.status_code == 200
    data = response.json()
    assert len(data) >= 3
    env_names = [e["name"] for e in data]
    assert "development" in env_names
    assert "staging" in env_names
    assert "production" in env_names


def test_get_individual_environments_by_name():
    for name in ["development", "staging", "production"]:
        response = client.get(f"/api/environments/{name}")
        assert response.status_code == 200
        data = response.json()
        assert data["name"] == name
        assert data["display_name"].lower() == name
        assert "status" in data
        assert "drift_count" in data


def test_get_individual_environments_by_id():
    list_res = client.get("/api/environments")
    first_id = list_res.json()[0]["id"]
    response = client.get(f"/api/environments/{first_id}")
    assert response.status_code == 200
    assert response.json()["id"] == first_id


def test_get_nonexistent_environment():
    response = client.get("/api/environments/nonexistent-env-999")
    assert response.status_code == 404
    data = response.json()
    assert "not found" in data["detail"].lower()


def test_create_and_update_environment():
    unique_suffix = uuid.uuid4().hex[:8]
    unique_name = f"qa-preprod-{unique_suffix}"
    new_env_payload = {
        "name": unique_name,
        "display_name": f"QA Pre-Production {unique_suffix}",
        "status": "HEALTHY",
        "config_version": 1,
        "deployment_status": "IDLE",
        "drift_count": 0,
        "critical_drift_count": 0
    }
    response = client.post("/api/environments", json=new_env_payload)
    assert response.status_code == 201
    created = response.json()
    assert created["name"] == unique_name
    env_id = created["id"]

    # Prevent duplicate environment
    dup_res = client.post("/api/environments", json=new_env_payload)
    assert dup_res.status_code == 400
    assert "already exists" in dup_res.json()["detail"].lower()

    # Update environment
    patch_res = client.patch(f"/api/environments/{env_id}", json={
        "status": "DRIFT_DETECTED",
        "drift_count": 2,
        "critical_drift_count": 1
    })
    assert patch_res.status_code == 200
    updated = patch_res.json()
    assert updated["status"] == "DRIFT_DETECTED"
    assert updated["drift_count"] == 2
    assert updated["critical_drift_count"] == 1


# 3. Configurations API Tests
def test_get_configuration_for_environment():
    response = client.get("/api/configurations/production")
    assert response.status_code == 200
    data = response.json()
    assert data["environment"] == "production"
    assert "version" in data
    assert "is_active" in data


def test_get_configuration_versions():
    response = client.get("/api/configurations/staging/versions")
    assert response.status_code == 200
    data = response.json()
    assert isinstance(data, list)
    assert len(data) >= 1
    assert data[0]["environment"] == "staging"
    assert "version" in data[0]


def test_get_configuration_nonexistent_env():
    response = client.get("/api/configurations/invalid-env-xyz")
    assert response.status_code == 404


# 4. Authentication & RBAC Tests
def test_auth_login_success():
    res = client.post("/api/auth/login", json={
        "email": "admin@example.com",
        "password": "admin123"
    })
    assert res.status_code == 200
    data = res.json()
    assert "access_token" in data
    assert data["user"]["role"] == "ADMIN"
    assert data["user"]["email"] == "admin@example.com"


def test_auth_login_invalid_credentials():
    res = client.post("/api/auth/login", json={
        "email": "admin@example.com",
        "password": "wrong_password_123"
    })
    assert res.status_code == 401
    assert "invalid" in res.json()["detail"].lower()


def test_protected_endpoint_without_token():
    res = client.get("/api/users")
    assert res.status_code == 401


def test_rbac_admin_allowed():
    # Login as admin
    login_res = client.post("/api/auth/login", json={
        "email": "admin@example.com",
        "password": "admin123"
    })
    token = login_res.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}

    # Access admin users endpoint
    res = client.get("/api/users", headers=headers)
    assert res.status_code == 200
    assert isinstance(res.json(), list)


def test_rbac_developer_forbidden_admin_routes():
    # Login as developer
    login_res = client.post("/api/auth/login", json={
        "email": "developer@example.com",
        "password": "dev123"
    })
    token = login_res.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}

    # Developer cannot access /api/users (Admin only)
    res = client.get("/api/users", headers=headers)
    assert res.status_code == 403
    assert "access denied" in res.json()["detail"].lower()


def test_auth_current_user_and_logout():
    login_res = client.post("/api/auth/login", json={
        "email": "devops@example.com",
        "password": "devops123"
    })
    token = login_res.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}

    # Get current user (/api/auth/me)
    me_res = client.get("/api/auth/me", headers=headers)
    assert me_res.status_code == 200
    assert me_res.json()["role"] == "DEVOPS"

    # Logout
    logout_res = client.post("/api/auth/logout", headers=headers)
    assert logout_res.status_code == 200


# 5. Audit Log Tests
def test_audit_logs_recorded():
    res = client.get("/api/audit-logs")
    assert res.status_code == 200
    logs = res.json()
    assert isinstance(logs, list)
    assert len(logs) > 0
    actions = [log["action"] for log in logs]
    # Check that events like AUTH_LOGIN_SUCCESS or ENVIRONMENT_CREATED exist in audit log
    assert any("AUTH" in a or "ENVIRONMENT" in a for a in actions)
