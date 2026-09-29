from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from backend.app.database.session import get_db
from backend.app.models.models import (
    SystemSetting, NotificationPreference, ValidationPolicy, DeploymentPolicy, User, AuditLog
)
from backend.app.schemas.schemas import (
    SystemSettingsSchema, NotificationPreferencesSchema,
    ValidationPoliciesSchema, DeploymentPoliciesSchema
)
from backend.app.routes.auth import get_current_user, require_admin

settings_router = APIRouter(prefix="/api/settings", tags=["Settings & Policies"])


@settings_router.get("/general", response_model=SystemSettingsSchema)
def get_general_settings(db: Session = Depends(get_db)):
    setting = db.query(SystemSetting).first()
    if not setting:
        setting = SystemSetting()
        db.add(setting)
        db.commit()
        db.refresh(setting)
    return SystemSettingsSchema(
        application_name=setting.application_name,
        default_environment=setting.default_environment,
        default_validation_mode=setting.default_validation_mode,
        default_risk_threshold=setting.default_risk_threshold,
        auto_revalidation=setting.auto_revalidation,
        auto_refresh_dashboard=setting.auto_refresh_dashboard,
        theme=setting.theme,
        remember_sidebar_state=setting.remember_sidebar_state,
        show_environment_health=setting.show_environment_health,
        show_risk_score=setting.show_risk_score,
        show_drift_trends=setting.show_drift_trends,
        session_timeout_minutes=setting.session_timeout_minutes,
        login_notifications=setting.login_notifications,
    )


@settings_router.put("/general")
def update_general_settings(
    payload: SystemSettingsSchema,
    admin_user: User = Depends(require_admin),
    db: Session = Depends(get_db)
):
    setting = db.query(SystemSetting).first()
    if not setting:
        setting = SystemSetting()
        db.add(setting)

    for k, v in payload.model_dump().items():
        setattr(setting, k, v)

    audit = AuditLog(
        action="SETTINGS_GENERAL_UPDATED",
        user=f"{admin_user.name} ({admin_user.email})",
        decision="APPROVED",
        reason="Updated global application settings."
    )
    db.add(audit)
    db.commit()
    return {"message": "Settings saved successfully", "settings": payload}


@settings_router.get("/notifications", response_model=NotificationPreferencesSchema)
def get_notification_settings(db: Session = Depends(get_db)):
    pref = db.query(NotificationPreference).first()
    if not pref:
        pref = NotificationPreference()
        db.add(pref)
        db.commit()
        db.refresh(pref)
    return NotificationPreferencesSchema(
        notify_critical_drift=pref.notify_critical_drift,
        notify_high_risk_deployment=pref.notify_high_risk_deployment,
        notify_deployment_blocked=pref.notify_deployment_blocked,
        notify_secret_expiry=pref.notify_secret_expiry,
        notify_runtime_drift=pref.notify_runtime_drift,
        notify_infrastructure_drift=pref.notify_infrastructure_drift,
        notify_change_request=pref.notify_change_request,
        notify_approval_required=pref.notify_approval_required,
        channel_in_app=pref.channel_in_app,
        channel_email=pref.channel_email,
        channel_slack=pref.channel_slack,
        channel_teams=pref.channel_teams,
        channel_webhook=pref.channel_webhook,
    )


@settings_router.put("/notifications")
def update_notification_settings(
    payload: NotificationPreferencesSchema,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    pref = db.query(NotificationPreference).first()
    if not pref:
        pref = NotificationPreference()
        db.add(pref)

    for k, v in payload.model_dump().items():
        setattr(pref, k, v)

    db.commit()
    return {"message": "Notification preferences saved successfully"}


@settings_router.get("/validation-policies", response_model=ValidationPoliciesSchema)
def get_validation_policies(db: Session = Depends(get_db)):
    pol = db.query(ValidationPolicy).first()
    if not pol:
        pol = ValidationPolicy()
        db.add(pol)
        db.commit()
        db.refresh(pol)
    return ValidationPoliciesSchema(
        critical_drift_action=pol.critical_drift_action,
        high_drift_action=pol.high_drift_action,
        medium_drift_action=pol.medium_drift_action,
        low_drift_action=pol.low_drift_action,
        critical_risk_threshold=pol.critical_risk_threshold,
        high_risk_threshold=pol.high_risk_threshold,
        medium_risk_threshold=pol.medium_risk_threshold,
    )


@settings_router.put("/validation-policies")
def update_validation_policies(
    payload: ValidationPoliciesSchema,
    admin_user: User = Depends(require_admin),
    db: Session = Depends(get_db)
):
    pol = db.query(ValidationPolicy).first()
    if not pol:
        pol = ValidationPolicy()
        db.add(pol)

    for k, v in payload.model_dump().items():
        setattr(pol, k, v)

    audit = AuditLog(
        action="VALIDATION_POLICIES_UPDATED",
        user=f"{admin_user.name} ({admin_user.email})",
        decision="APPROVED",
        reason="Updated gatekeeper validation thresholds and actions."
    )
    db.add(audit)
    db.commit()
    return {"message": "Validation policies saved successfully"}


@settings_router.get("/deployment-policies", response_model=DeploymentPoliciesSchema)
def get_deployment_policies(db: Session = Depends(get_db)):
    pol = db.query(DeploymentPolicy).first()
    if not pol:
        pol = DeploymentPolicy()
        db.add(pol)
        db.commit()
        db.refresh(pol)
    return DeploymentPoliciesSchema(
        environment=pol.environment,
        critical_drift_action=pol.critical_drift_action,
        high_risk_action=pol.high_risk_action,
        medium_risk_action=pol.medium_risk_action,
        no_drift_action=pol.no_drift_action,
        require_release_manager_approval=pol.require_release_manager_approval,
        require_revalidation_before_deployment=pol.require_revalidation_before_deployment,
        require_audit_log=pol.require_audit_log,
    )


@settings_router.put("/deployment-policies")
def update_deployment_policies(
    payload: DeploymentPoliciesSchema,
    admin_user: User = Depends(require_admin),
    db: Session = Depends(get_db)
):
    pol = db.query(DeploymentPolicy).first()
    if not pol:
        pol = DeploymentPolicy()
        db.add(pol)

    for k, v in payload.model_dump().items():
        setattr(pol, k, v)

    audit = AuditLog(
        action="DEPLOYMENT_POLICIES_UPDATED",
        user=f"{admin_user.name} ({admin_user.email})",
        decision="APPROVED",
        reason="Modified production deployment approval safety policies."
    )
    db.add(audit)
    db.commit()
    return {"message": "Deployment policies saved successfully"}
