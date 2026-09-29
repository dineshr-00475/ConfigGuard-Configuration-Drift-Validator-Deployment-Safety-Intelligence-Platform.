from datetime import datetime
from typing import Optional, List
from sqlalchemy.orm import Session
from backend.app.models.models import AuditLog


def record_audit_log(
    db: Session,
    action: str,
    user: str = "system",
    role: Optional[str] = None,
    environment: Optional[str] = None,
    environment_id: Optional[int] = None,
    decision: Optional[str] = None,
    reason: Optional[str] = None,
    drift_count: int = 0,
    critical_drift_count: int = 0,
) -> AuditLog:
    """Reusable audit logging service function for recording critical system actions."""
    audit = AuditLog(
        action=action,
        user=user,
        role=role,
        environment_name=environment,
        environment_id=environment_id,
        decision=decision,
        reason=reason,
        drift_count=drift_count,
        critical_drift_count=critical_drift_count,
        timestamp=datetime.utcnow(),
    )
    db.add(audit)
    db.commit()
    db.refresh(audit)
    return audit


def get_audit_logs(
    db: Session,
    limit: int = 50,
    environment: Optional[str] = None,
    action: Optional[str] = None,
) -> List[AuditLog]:
    """Retrieve filtered audit trail records."""
    query = db.query(AuditLog).order_by(AuditLog.timestamp.desc())
    if environment:
        query = query.filter(AuditLog.environment_name == environment)
    if action:
        query = query.filter(AuditLog.action == action)
    return query.limit(limit).all()
