from datetime import datetime
from sqlalchemy import (
    Column, Integer, String, Text, Boolean, DateTime, ForeignKey, Float
)
from sqlalchemy.orm import relationship
from backend.app.database.session import Base


class Environment(Base):
    __tablename__ = "environments"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(50), unique=True, nullable=False, index=True)  # development, staging, production
    display_name = Column(String(100), nullable=False)
    status = Column(String(50), default="HEALTHY")  # HEALTHY, DRIFT_DETECTED, BLOCKED, WARNING
    config_version = Column(Integer, default=1)
    last_validation_time = Column(DateTime, nullable=True)
    deployment_status = Column(String(50), default="IDLE")  # APPROVED, BLOCKED, MANUAL_REVIEW, IDLE
    drift_count = Column(Integer, default=0)
    critical_drift_count = Column(Integer, default=0)
    readiness_score = Column(Integer, default=100)
    health_score = Column(Integer, default=100)
    risk_points = Column(Integer, default=0)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships
    configurations = relationship("Configuration", back_populates="environment", cascade="all, delete-orphan")
    infrastructure = relationship("InfrastructureDefinition", back_populates="environment", cascade="all, delete-orphan")
    env_variables = relationship("EnvironmentVariable", back_populates="environment", cascade="all, delete-orphan")
    secrets = relationship("SecretMetadata", back_populates="environment", cascade="all, delete-orphan")
    runtime_snapshots = relationship("RuntimeSnapshot", back_populates="environment", cascade="all, delete-orphan")
    drifts = relationship("DriftRecord", back_populates="environment", cascade="all, delete-orphan")
    deployments = relationship("Deployment", back_populates="environment", cascade="all, delete-orphan")
    audit_logs = relationship("AuditLog", back_populates="environment", cascade="all, delete-orphan")


class Configuration(Base):
    __tablename__ = "configurations"

    id = Column(Integer, primary_key=True, index=True)
    environment_id = Column(Integer, ForeignKey("environments.id"), nullable=False)
    version = Column(Integer, nullable=False)
    description = Column(String(255), nullable=True)
    is_active = Column(Boolean, default=True)
    is_safe = Column(Boolean, default=False)
    fingerprint = Column(String(100), nullable=True)
    author = Column(String(100), default="system")
    comment = Column(String(255), nullable=True)
    config_data_json = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    environment = relationship("Environment", back_populates="configurations")


class InfrastructureDefinition(Base):
    __tablename__ = "infrastructure_definitions"

    id = Column(Integer, primary_key=True, index=True)
    environment_id = Column(Integer, ForeignKey("environments.id"), nullable=False)
    is_actual = Column(Boolean, default=False)  # False = expected, True = actual
    cpu = Column(Integer, nullable=False)
    memory = Column(String(50), nullable=False)
    database = Column(String(50), nullable=False)
    replicas = Column(Integer, nullable=False)
    max_connections = Column(Integer, nullable=False)
    raw_json = Column(Text, nullable=True)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    environment = relationship("Environment", back_populates="infrastructure")


class EnvironmentVariable(Base):
    __tablename__ = "environment_variables"

    id = Column(Integer, primary_key=True, index=True)
    environment_id = Column(Integer, ForeignKey("environments.id"), nullable=False)
    key = Column(String(100), nullable=False, index=True)
    value = Column(String(255), nullable=False)
    is_actual = Column(Boolean, default=False)  # False = expected, True = actual
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    environment = relationship("Environment", back_populates="env_variables")


class SecretMetadata(Base):
    __tablename__ = "secret_metadata"

    id = Column(Integer, primary_key=True, index=True)
    environment_id = Column(Integer, ForeignKey("environments.id"), nullable=False)
    name = Column(String(100), nullable=False, index=True)
    version = Column(Integer, nullable=False)
    status = Column(String(50), default="active")  # active, inactive, deprecated
    last_updated = Column(String(50), nullable=True)
    is_actual = Column(Boolean, default=False)  # False = expected, True = actual (or missing)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    environment = relationship("Environment", back_populates="secrets")


class RuntimeSnapshot(Base):
    __tablename__ = "runtime_snapshots"

    id = Column(Integer, primary_key=True, index=True)
    environment_id = Column(Integer, ForeignKey("environments.id"), nullable=False)
    api_url = Column(String(255), nullable=True)
    payment_mode = Column(String(50), nullable=True)
    max_connections = Column(Integer, nullable=True)
    replicas = Column(Integer, nullable=True)
    snapshot_time = Column(DateTime, default=datetime.utcnow)
    raw_json = Column(Text, nullable=True)

    environment = relationship("Environment", back_populates="runtime_snapshots")


class DriftRecord(Base):
    __tablename__ = "drift_records"

    id = Column(Integer, primary_key=True, index=True)
    environment_id = Column(Integer, ForeignKey("environments.id"), nullable=False)
    category = Column(String(50), nullable=False)  # infrastructure, environment_variable, secret_metadata, runtime
    key = Column(String(100), nullable=False)
    expected_value = Column(String(255), nullable=True)
    actual_value = Column(String(255), nullable=True)
    severity = Column(String(20), nullable=False)  # LOW, MEDIUM, HIGH, CRITICAL
    risk_points = Column(Integer, default=10)
    reason = Column(Text, nullable=False)
    impact = Column(Text, nullable=True)
    root_cause = Column(Text, nullable=True)
    recommended_fix = Column(Text, nullable=True)
    status = Column(String(20), default="OPEN")  # OPEN, RESOLVED, ACKNOWLEDGED
    created_at = Column(DateTime, default=datetime.utcnow)

    environment = relationship("Environment", back_populates="drifts")


class Deployment(Base):
    __tablename__ = "deployments"

    id = Column(Integer, primary_key=True, index=True)
    environment_id = Column(Integer, ForeignKey("environments.id"), nullable=False)
    config_version = Column(Integer, nullable=False)
    status = Column(String(50), nullable=False)  # PENDING, COMPLETED, REJECTED
    decision = Column(String(50), nullable=False)  # APPROVED, APPROVED WITH WARNING, MANUAL REVIEW, BLOCKED
    reason = Column(Text, nullable=False)
    drift_count = Column(Integer, default=0)
    critical_count = Column(Integer, default=0)
    infrastructure_check = Column(String(20), default="PASS")  # PASS, WARNING, FAIL
    env_var_check = Column(String(20), default="PASS")
    secret_check = Column(String(20), default="PASS")
    runtime_check = Column(String(20), default="PASS")
    validated_at = Column(DateTime, default=datetime.utcnow)

    environment = relationship("Environment", back_populates="deployments")


class Event(Base):
    __tablename__ = "events"

    id = Column(Integer, primary_key=True, index=True)
    event_id = Column(String(100), unique=True, nullable=False, index=True)
    environment = Column(String(50), nullable=False)
    event_type = Column(String(50), nullable=False)  # CONFIG_UPDATED, INFRA_SCALED, SECRET_ROTATED, RUNTIME_SYNC
    version = Column(Integer, nullable=False)
    timestamp = Column(String(100), nullable=False)
    payload_json = Column(Text, nullable=False)
    processed_at = Column(DateTime, default=datetime.utcnow)
    status = Column(String(50), default="PROCESSED")  # PROCESSED, IGNORED_DUPLICATE, IGNORED_OUTDATED


class AuditLog(Base):
    __tablename__ = "audit_logs"

    id = Column(Integer, primary_key=True, index=True)
    environment_id = Column(Integer, ForeignKey("environments.id"), nullable=True)
    environment_name = Column(String(50), nullable=True)
    action = Column(String(100), nullable=False)
    user = Column(String(100), default="system")
    role = Column(String(50), nullable=True)
    decision = Column(String(50), nullable=True)
    drift_count = Column(Integer, default=0)
    critical_drift_count = Column(Integer, default=0)
    reason = Column(Text, nullable=True)
    timestamp = Column(DateTime, default=datetime.utcnow)

    environment = relationship("Environment", back_populates="audit_logs")


class Role(Base):
    __tablename__ = "roles"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(50), unique=True, nullable=False, index=True)  # ADMIN, DEVELOPER, DEVOPS, RELEASE_MANAGER
    description = Column(String(255), nullable=True)
    permissions_json = Column(Text, nullable=True)  # JSON array of permission strings
    created_at = Column(DateTime, default=datetime.utcnow)


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(100), nullable=False)
    email = Column(String(100), unique=True, nullable=False, index=True)
    hashed_password = Column(String(255), nullable=False)
    role = Column(String(50), nullable=False, default="DEVELOPER")  # ADMIN, DEVELOPER, DEVOPS, RELEASE_MANAGER
    status = Column(String(20), default="ACTIVE")  # ACTIVE, DISABLED
    two_factor_enabled = Column(Boolean, default=False)
    last_login = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    sessions = relationship("UserSession", back_populates="user", cascade="all, delete-orphan")


class UserSession(Base):
    __tablename__ = "user_sessions"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    token = Column(String(255), unique=True, nullable=False, index=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    expires_at = Column(DateTime, nullable=False)
    is_active = Column(Boolean, default=True)

    user = relationship("User", back_populates="sessions")


class SystemSetting(Base):
    __tablename__ = "system_settings"

    id = Column(Integer, primary_key=True, index=True)
    application_name = Column(String(100), default="Configuration Drift Validator")
    default_environment = Column(String(50), default="production")
    default_validation_mode = Column(String(50), default="Strict")
    default_risk_threshold = Column(Integer, default=80)
    auto_revalidation = Column(Boolean, default=True)
    auto_refresh_dashboard = Column(Boolean, default=True)
    theme = Column(String(20), default="light")
    remember_sidebar_state = Column(Boolean, default=True)
    show_environment_health = Column(Boolean, default=True)
    show_risk_score = Column(Boolean, default=True)
    show_drift_trends = Column(Boolean, default=True)
    session_timeout_minutes = Column(Integer, default=30)
    login_notifications = Column(Boolean, default=True)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


class NotificationPreference(Base):
    __tablename__ = "notification_preferences"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    notify_critical_drift = Column(Boolean, default=True)
    notify_high_risk_deployment = Column(Boolean, default=True)
    notify_deployment_blocked = Column(Boolean, default=True)
    notify_secret_expiry = Column(Boolean, default=True)
    notify_runtime_drift = Column(Boolean, default=True)
    notify_infrastructure_drift = Column(Boolean, default=True)
    notify_change_request = Column(Boolean, default=True)
    notify_approval_required = Column(Boolean, default=True)
    channel_in_app = Column(Boolean, default=True)
    channel_email = Column(Boolean, default=False)
    channel_slack = Column(Boolean, default=False)
    channel_teams = Column(Boolean, default=False)
    channel_webhook = Column(Boolean, default=False)


class ValidationPolicy(Base):
    __tablename__ = "validation_policies"

    id = Column(Integer, primary_key=True, index=True)
    critical_drift_action = Column(String(50), default="BLOCK")  # BLOCK, MANUAL_REVIEW, WARNING, ALLOW
    high_drift_action = Column(String(50), default="MANUAL_REVIEW")
    medium_drift_action = Column(String(50), default="WARNING")
    low_drift_action = Column(String(50), default="ALLOW")
    critical_risk_threshold = Column(Integer, default=90)
    high_risk_threshold = Column(Integer, default=70)
    medium_risk_threshold = Column(Integer, default=40)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


class DeploymentPolicy(Base):
    __tablename__ = "deployment_policies"

    id = Column(Integer, primary_key=True, index=True)
    environment = Column(String(50), default="production")
    critical_drift_action = Column(String(50), default="BLOCK")
    high_risk_action = Column(String(50), default="MANUAL_REVIEW")
    medium_risk_action = Column(String(50), default="MANUAL_REVIEW")
    no_drift_action = Column(String(50), default="AUTO_APPROVE")
    require_release_manager_approval = Column(Boolean, default=True)
    require_revalidation_before_deployment = Column(Boolean, default=True)
    require_audit_log = Column(Boolean, default=True)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


class Notification(Base):
    __tablename__ = "notifications"

    id = Column(Integer, primary_key=True, index=True)
    environment_name = Column(String(50), nullable=True)
    title = Column(String(255), nullable=False)
    severity = Column(String(20), default="MEDIUM")  # CRITICAL, HIGH, MEDIUM, LOW
    issue = Column(Text, nullable=False)
    expected = Column(String(255), nullable=True)
    actual = Column(String(255), nullable=True)
    is_read = Column(Boolean, default=False)
    created_at = Column(DateTime, default=datetime.utcnow)


class SimulationRecord(Base):
    __tablename__ = "simulation_records"

    id = Column(Integer, primary_key=True, index=True)
    scenario_key = Column(String(100), nullable=False)
    title = Column(String(255), nullable=False)
    environment_name = Column(String(50), nullable=False)
    severity = Column(String(20), nullable=False)
    status = Column(String(50), default="ACTIVE")  # ACTIVE, RECOVERED
    injected_by = Column(String(100), default="system")
    details_json = Column(Text, nullable=True)
    injected_at = Column(DateTime, default=datetime.utcnow)
    recovered_at = Column(DateTime, nullable=True)


class BenchmarkRecord(Base):
    __tablename__ = "benchmark_records"

    id = Column(Integer, primary_key=True, index=True)
    run_name = Column(String(100), nullable=False)
    total_scenarios = Column(Integer, default=100)
    faulty_scenarios = Column(Integer, default=0)
    baseline_detected = Column(Integer, default=0)
    configguard_detected = Column(Integer, default=0)
    baseline_detection_rate = Column(Float, default=0.0)
    configguard_detection_rate = Column(Float, default=0.0)
    baseline_avg_time_ms = Column(Float, default=0.0)
    configguard_avg_time_ms = Column(Float, default=0.0)
    false_positives = Column(Integer, default=0)
    false_negatives = Column(Integer, default=0)
    blocked_deployments = Column(Integer, default=0)
    created_at = Column(DateTime, default=datetime.utcnow)


class BenchmarkRun(Base):
    __tablename__ = "benchmark_runs"

    id = Column(Integer, primary_key=True, index=True)
    run_name = Column(String(100), nullable=False, unique=True, index=True)
    total_scenarios = Column(Integer, default=100)
    healthy_scenarios = Column(Integer, default=0)
    faulty_scenarios = Column(Integer, default=0)
    baseline_detected = Column(Integer, default=0)
    baseline_missed = Column(Integer, default=0)
    baseline_detection_rate = Column(Float, default=0.0)
    baseline_avg_time_ms = Column(Float, default=0.0)
    baseline_false_positives = Column(Integer, default=0)
    baseline_false_negatives = Column(Integer, default=0)
    configguard_detected = Column(Integer, default=0)
    configguard_missed = Column(Integer, default=0)
    configguard_detection_rate = Column(Float, default=0.0)
    configguard_avg_time_ms = Column(Float, default=0.0)
    configguard_false_positives = Column(Integer, default=0)
    configguard_false_negatives = Column(Integer, default=0)
    detection_improvement_pct = Column(Float, default=0.0)
    blocked_deployments = Column(Integer, default=0)
    executed_by = Column(String(100), default="Chaos Engineering Suite")
    created_at = Column(DateTime, default=datetime.utcnow)

    scenarios = relationship("BenchmarkScenario", back_populates="run", cascade="all, delete-orphan")


class BenchmarkScenario(Base):
    __tablename__ = "benchmark_scenarios"

    id = Column(Integer, primary_key=True, index=True)
    run_id = Column(Integer, ForeignKey("benchmark_runs.id"), nullable=False, index=True)
    scenario_id = Column(String(50), nullable=False, index=True)
    scenario_type = Column(String(100), nullable=False, index=True)
    title = Column(String(255), nullable=False)
    description = Column(Text, nullable=True)
    expected_failure = Column(Boolean, default=True)  # True = faulty scenario, False = healthy
    baseline_result = Column(String(50), nullable=False)  # DETECTED or MISSED
    configguard_result = Column(String(50), nullable=False)  # DETECTED or CLEAN
    validation_time = Column(Float, default=0.0)  # ms
    detected = Column(Boolean, default=False)
    severity = Column(String(20), default="NONE")  # CRITICAL, HIGH, MEDIUM, LOW, NONE
    risk_score = Column(Integer, default=0)
    decision = Column(String(50), default="APPROVED")  # APPROVED, APPROVED_WITH_WARNING, MANUAL_REVIEW, BLOCKED
    drift_details_json = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    run = relationship("BenchmarkRun", back_populates="scenarios")


class ExperimentResult(Base):
    __tablename__ = "experiment_results"

    id = Column(Integer, primary_key=True, index=True)
    experiment_name = Column(String(100), nullable=False, index=True)
    total_runs = Column(Integer, default=1)
    status = Column(String(50), default="COMPLETED")
    summary_json = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)


class PipelineExecution(Base):
    __tablename__ = "pipeline_executions"

    id = Column(Integer, primary_key=True, index=True)
    pipeline_id = Column(String(60), unique=True, nullable=False, index=True)
    environment = Column(String(50), nullable=False, index=True)
    version_tag = Column(String(100), nullable=False, default="v2.4.0-flash-sale")
    commit_sha = Column(String(60), nullable=False, default="a94f82c")
    triggered_by = Column(String(100), nullable=False, default="system")
    overall_status = Column(String(50), nullable=False)  # COMPLETED, BLOCKED, AWAITING_APPROVAL, FAILED
    current_stage = Column(String(50), nullable=False)
    blocked_stage = Column(String(50), nullable=True)
    failure_reason = Column(Text, nullable=True)
    risk_score = Column(Integer, default=0)
    drift_count = Column(Integer, default=0)
    critical_drift_count = Column(Integer, default=0)
    stages_json = Column(Text, nullable=False)
    duration_ms = Column(Float, default=0.0)
    created_at = Column(DateTime, default=datetime.utcnow)
    completed_at = Column(DateTime, nullable=True)


class Incident(Base):
    __tablename__ = "incidents"

    id = Column(Integer, primary_key=True, index=True)
    incident_id = Column(String(50), unique=True, nullable=False, index=True)
    environment = Column(String(50), nullable=False, index=True)
    severity = Column(String(20), nullable=False, index=True)  # CRITICAL, HIGH, MEDIUM, LOW
    affected_component = Column(String(150), nullable=False)
    drift_key = Column(String(100), nullable=True, index=True)
    root_cause = Column(Text, nullable=False)
    assigned_user = Column(String(100), nullable=False, default="devops@driftguard.io")
    status = Column(String(30), nullable=False, default="Open")  # Open, Investigating, Resolved, Closed
    resolution_notes = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    resolved_at = Column(DateTime, nullable=True)


class ChangeRequestRecord(Base):
    __tablename__ = "change_requests"

    id = Column(Integer, primary_key=True, index=True)
    cr_id = Column(String(50), unique=True, nullable=False, index=True)
    title = Column(String(200), nullable=False)
    environment = Column(String(50), nullable=False, index=True)
    category = Column(String(50), nullable=False, default="env_variable")
    parameter_key = Column(String(100), nullable=False)
    previous_value = Column(Text, nullable=False)
    proposed_value = Column(Text, nullable=False)
    requested_changes = Column(Text, nullable=False)
    reason = Column(Text, nullable=False)
    risk_score = Column(Integer, default=25)
    requester_name = Column(String(100), nullable=False)
    requester_email = Column(String(100), nullable=False)
    requester_role = Column(String(50), nullable=False, default="DEVELOPER")
    devops_reviewer = Column(String(100), nullable=True)
    devops_review_notes = Column(Text, nullable=True)
    devops_reviewed_at = Column(DateTime, nullable=True)
    approver_name = Column(String(100), nullable=True)
    approver_email = Column(String(100), nullable=True)
    approver_role = Column(String(50), nullable=True)
    approval_notes = Column(Text, nullable=True)
    approved_at = Column(DateTime, nullable=True)
    approval_status = Column(String(40), nullable=False, default="PENDING_DEVOPS_REVIEW")  # PENDING_DEVOPS_REVIEW, PENDING_APPROVAL, APPROVED, REJECTED
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


class PerformanceMetric(Base):
    __tablename__ = "performance_metrics"

    id = Column(Integer, primary_key=True, index=True)
    metric_type = Column(String(50), nullable=False, index=True)  # VALIDATION, API_REQUEST, DB_OPERATION, EVENT_PROCESSING, RECOVERY
    operation = Column(String(150), nullable=False)
    environment = Column(String(50), nullable=True)
    duration_ms = Column(Float, nullable=False)
    success = Column(Boolean, default=True)
    status_code = Column(Integer, default=200)
    details_json = Column(Text, nullable=True)
    recorded_at = Column(DateTime, default=datetime.utcnow, index=True)


class SystemErrorLog(Base):
    __tablename__ = "system_error_logs"

    id = Column(Integer, primary_key=True, index=True)
    component = Column(String(100), nullable=False)
    endpoint = Column(String(150), nullable=True)
    error_type = Column(String(100), nullable=False)
    message = Column(Text, nullable=False)
    severity = Column(String(20), default="ERROR")  # WARNING, ERROR, CRITICAL
    resolved = Column(Boolean, default=False)
    occurred_at = Column(DateTime, default=datetime.utcnow, index=True)



