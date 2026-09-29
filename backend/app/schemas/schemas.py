from datetime import datetime
from typing import Optional, List, Dict, Any
from pydantic import BaseModel, Field

try:
    from pydantic import ConfigDict
except ImportError:
    ConfigDict = None

# Ensure backwards and forwards compatibility across Pydantic v1 and v2
if not hasattr(BaseModel, "model_validate"):
    @classmethod
    def _model_validate(cls, obj, **kwargs):
        if hasattr(cls, "from_orm"):
            try:
                return cls.from_orm(obj)
            except Exception:
                pass
        if isinstance(obj, dict):
            return cls(**obj)
        if hasattr(obj, "__dict__"):
            return cls(**{k: v for k, v in obj.__dict__.items() if not k.startswith("_")})
        return cls(obj)
    BaseModel.model_validate = _model_validate


class HealthResponse(BaseModel):
    status: str = "healthy"
    service: str = "Configuration-Drift Validator API"
    database: str = "connected"
    timestamp: datetime = Field(default_factory=datetime.utcnow)


class EnvironmentBase(BaseModel):
    name: str
    display_name: str
    status: str = "HEALTHY"
    config_version: int = 1
    deployment_status: str = "IDLE"
    drift_count: int = 0
    critical_drift_count: int = 0


class EnvironmentCreate(EnvironmentBase):
    pass


class EnvironmentUpdate(BaseModel):
    display_name: Optional[str] = None
    status: Optional[str] = None
    config_version: Optional[int] = None
    deployment_status: Optional[str] = None
    drift_count: Optional[int] = None
    critical_drift_count: Optional[int] = None


class EnvironmentResponse(EnvironmentBase):
    id: int
    last_validation_time: Optional[datetime] = None
    created_at: datetime
    updated_at: datetime

    class Config:
        orm_mode = True
        from_attributes = True


class EnvironmentDetailResponse(EnvironmentResponse):
    configurations_count: int = 0
    drifts_count: int = 0
    recent_drifts: List[Dict[str, Any]] = []
    latest_deployment: Optional[Dict[str, Any]] = None

    class Config:
        orm_mode = True
        from_attributes = True


# Configuration Foundation Schemas
class ConfigurationResponse(BaseModel):
    id: int
    environment: str
    version: int
    description: Optional[str] = None
    is_active: bool = True
    created_at: datetime

    class Config:
        orm_mode = True
        from_attributes = True


class ConfigurationVersionResponse(BaseModel):
    version: int
    environment: str
    description: Optional[str] = None
    is_active: bool = True
    created_at: datetime

    class Config:
        orm_mode = True
        from_attributes = True


# Audit Log Schemas
class AuditLogResponse(BaseModel):
    id: int
    environment_id: Optional[int] = None
    environment_name: Optional[str] = None
    action: str
    user: str
    role: Optional[str] = None
    decision: Optional[str] = None
    drift_count: int = 0
    critical_drift_count: int = 0
    reason: Optional[str] = None
    timestamp: datetime

    class Config:
        orm_mode = True
        from_attributes = True


# Authentication & User Schemas
class LoginRequest(BaseModel):
    email: str
    password: str
    remember_me: bool = False


class UserResponse(BaseModel):
    id: int
    name: str
    email: str
    role: str
    status: str
    two_factor_enabled: bool = False
    last_login: Optional[datetime] = None
    created_at: Optional[datetime] = None

    class Config:
        orm_mode = True
        from_attributes = True


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    expires_in: int = 1800  # 30 minutes in seconds
    user: UserResponse


class CreateUserRequest(BaseModel):
    name: str
    email: str
    password: str
    role: str = "DEVELOPER"
    status: str = "ACTIVE"


class UpdateUserRequest(BaseModel):
    name: Optional[str] = None
    email: Optional[str] = None
    role: Optional[str] = None
    status: Optional[str] = None


class ChangePasswordRequest(BaseModel):
    current_password: str
    new_password: str
    confirm_password: str


class ErrorResponse(BaseModel):
    detail: str
    error_code: Optional[str] = None
    timestamp: datetime = Field(default_factory=datetime.utcnow)


class SystemSettingsSchema(BaseModel):
    application_name: str = "Configuration Drift Validator"
    default_environment: str = "production"
    default_validation_mode: str = "Strict"
    default_risk_threshold: int = 80
    auto_revalidation: bool = True
    auto_refresh_dashboard: bool = True
    theme: str = "light"
    remember_sidebar_state: bool = True
    show_environment_health: bool = True
    show_risk_score: bool = True
    show_drift_trends: bool = True
    session_timeout_minutes: int = 30
    login_notifications: bool = True


class NotificationPreferencesSchema(BaseModel):
    notify_critical_drift: bool = True
    notify_high_risk_deployment: bool = True
    notify_deployment_blocked: bool = True
    notify_secret_expiry: bool = True
    notify_runtime_drift: bool = True
    notify_infrastructure_drift: bool = True
    notify_change_request: bool = True
    notify_approval_required: bool = True
    channel_in_app: bool = True
    channel_email: bool = False
    channel_slack: bool = False
    channel_teams: bool = False
    channel_webhook: bool = False


class ValidationPoliciesSchema(BaseModel):
    critical_drift_action: str = "BLOCK"
    high_drift_action: str = "MANUAL_REVIEW"
    medium_drift_action: str = "WARNING"
    low_drift_action: str = "ALLOW"
    critical_risk_threshold: int = 90
    high_risk_threshold: int = 70
    medium_risk_threshold: int = 40


class DeploymentPoliciesSchema(BaseModel):
    environment: str = "production"
    critical_drift_action: str = "BLOCK"
    high_risk_action: str = "MANUAL_REVIEW"
    medium_risk_action: str = "MANUAL_REVIEW"
    no_drift_action: str = "AUTO_APPROVE"
    require_release_manager_approval: bool = True
    require_revalidation_before_deployment: bool = True
    require_audit_log: bool = True


# Drift & Validation Schemas
class DriftItemSchema(BaseModel):
    id: Optional[int] = None
    environment_id: Optional[int] = None
    category: str
    key: str
    expected_value: Any
    actual_value: Any
    severity: str  # LOW, MEDIUM, HIGH, CRITICAL
    risk_points: int = 10
    reason: str
    impact: Optional[str] = None
    root_cause: Optional[str] = None
    recommended_fix: Optional[str] = None
    status: str = "OPEN"
    created_at: Optional[datetime] = None

    class Config:
        orm_mode = True
        from_attributes = True


class ValidationResultSchema(BaseModel):
    environment_id: int
    environment_name: str
    status: str
    config_version: int
    readiness_score: int
    health_score: int
    risk_points: int
    risk_level: str
    risk_explanation: str
    deployment_decision: str
    decision_reason: str
    drift_count: int
    critical_count: int
    high_count: int
    medium_count: int
    low_count: int
    drifts: List[DriftItemSchema] = []
    fingerprint_expected: str
    fingerprint_actual: str
    checks: Dict[str, str] = {}
    validated_at: datetime


class RootCauseAnalysisSchema(BaseModel):
    environment: str
    root_cause: str
    evidence: List[str]
    affected_components: List[str]
    recommended_fix: str
    confidence_level: str  # HIGH, MEDIUM, LOW


class ProductionSafetyScoreSchema(BaseModel):
    environment: str
    overall_score: int
    infrastructure_score: int
    env_vars_score: int
    secrets_score: int
    runtime_score: int
    dependencies_score: int
    explanation: str


class FixDriftRequest(BaseModel):
    environment: str
    drift_key: str
    target_value: Optional[Any] = None


class WhatIfSimulationRequest(BaseModel):
    environment: str = "production"
    modifications: Dict[str, Any] = {}


class WhatIfSimulationResponse(BaseModel):
    environment: str
    original_drifts: int
    simulated_drifts: int
    simulated_risk_score: int
    simulated_risk_level: str
    simulated_decision: str
    drift_deltas: List[Dict[str, Any]] = []
    potential_impact: str


class ScenarioInfoSchema(BaseModel):
    key: str
    title: str
    target_env: str
    category: str
    severity: str
    description: str
    flash_sale_risk: str


class InjectScenarioRequest(BaseModel):
    scenario_key: str
    environment: str = "production"


class EventRequest(BaseModel):
    event_id: str
    environment: str = "production"
    event_type: str = "CONFIG_SYNC"
    version: int
    timestamp: Optional[datetime] = None
    payload: Dict[str, Any] = {}


EventPayloadRequest = EventRequest


class EventResponse(BaseModel):
    status: str  # PROCESSED, IGNORED_DUPLICATE, REJECTED_OLD_VERSION
    event_id: str
    version: int
    action: str
    message: str
    processed_at: datetime = Field(default_factory=datetime.utcnow)


class NotificationSchema(BaseModel):
    id: int
    environment_name: Optional[str] = None
    title: str
    severity: str
    issue: str
    expected: Optional[str] = None
    actual: Optional[str] = None
    is_read: bool = False
    created_at: datetime

    class Config:
        orm_mode = True
        from_attributes = True


class DashboardMetricsSchema(BaseModel):
    total_environments: int
    total_configurations: int
    total_validations: int
    total_drifts: int
    critical_drifts: int
    high_drifts: int
    medium_drifts: int
    low_drifts: int
    approved_deployments: int
    blocked_deployments: int
    detection_rate: float
    fleet_risk_score: int
    production_safety_score: int
    drift_trends: List[Dict[str, Any]] = []
    severity_distribution: Dict[str, int] = {}
    environment_health: List[Dict[str, Any]] = []
    deployment_decisions: Dict[str, int] = {}


class BenchmarkRequest(BaseModel):
    total_scenarios: int = 100


class BenchmarkResultSchema(BaseModel):
    id: Optional[int] = None
    run_name: str
    total_scenarios: int
    healthy_scenarios: Optional[int] = 0
    faulty_scenarios: int
    baseline_detected: int
    baseline_missed: Optional[int] = 0
    configguard_detected: int
    configguard_missed: Optional[int] = 0
    baseline_detection_rate: float
    configguard_detection_rate: float
    baseline_avg_time_ms: float
    configguard_avg_time_ms: float
    false_positives: Optional[int] = 0
    false_negatives: Optional[int] = 0
    baseline_false_positives: Optional[int] = 0
    baseline_false_negatives: Optional[int] = 0
    configguard_false_positives: Optional[int] = 0
    configguard_false_negatives: Optional[int] = 0
    detection_improvement_pct: Optional[float] = 0.0
    blocked_deployments: int
    created_at: Optional[str] = None
    scenarios: List[Dict[str, Any]] = []

