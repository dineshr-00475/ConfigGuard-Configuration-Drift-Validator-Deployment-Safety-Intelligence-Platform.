from typing import List, Optional
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from backend.app.database.session import get_db
from backend.app.schemas.schemas import AuditLogResponse
from backend.app.services.audit_service import get_audit_logs

audit_router = APIRouter(prefix="/api/audit-logs", tags=["Audit Logs"])


@audit_router.get("", response_model=List[AuditLogResponse])
def list_audit_logs(
    limit: int = 50,
    environment: Optional[str] = None,
    action: Optional[str] = None,
    db: Session = Depends(get_db),
):
    return get_audit_logs(db, limit=limit, environment=environment, action=action)
