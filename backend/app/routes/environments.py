from datetime import datetime
from typing import List
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy import or_
from backend.app.database.session import get_db
from backend.app.models.models import Environment, DriftRecord, Deployment
from backend.app.schemas.schemas import (
    EnvironmentResponse,
    EnvironmentCreate,
    EnvironmentUpdate,
    EnvironmentDetailResponse,
)
from backend.app.services.audit_service import record_audit_log

router = APIRouter(prefix="/api/environments", tags=["Environments"])


def find_environment(identifier: str, db: Session) -> Environment:
    """Helper to locate an environment by integer ID or name (case-insensitive)."""
    env = None
    # Check if identifier is an integer ID
    if identifier.isdigit():
        env = db.query(Environment).filter(Environment.id == int(identifier)).first()
    if not env:
        env = db.query(Environment).filter(Environment.name == identifier.lower().strip()).first()
    return env


@router.get("", response_model=List[EnvironmentResponse])
def list_environments(db: Session = Depends(get_db)):
    """List all configured environments (development, staging, production, etc.)."""
    return db.query(Environment).order_by(Environment.id.asc()).all()


@router.get("/{environment_id}", response_model=EnvironmentDetailResponse)
def get_environment(environment_id: str, db: Session = Depends(get_db)):
    """Get detailed status for a specific environment by numeric ID or slug name."""
    env = find_environment(environment_id, db)
    if not env:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Environment '{environment_id}' not found"
        )

    # Get recent drifts
    recent_drifts = (
        db.query(DriftRecord)
        .filter(DriftRecord.environment_id == env.id)
        .order_by(DriftRecord.created_at.desc())
        .limit(5)
        .all()
    )

    # Get latest deployment
    latest_dep = (
        db.query(Deployment)
        .filter(Deployment.environment_id == env.id)
        .order_by(Deployment.validated_at.desc())
        .first()
    )

    return EnvironmentDetailResponse(
        id=env.id,
        name=env.name,
        display_name=env.display_name,
        status=env.status,
        config_version=env.config_version,
        last_validation_time=env.last_validation_time,
        deployment_status=env.deployment_status,
        drift_count=env.drift_count,
        critical_drift_count=env.critical_drift_count,
        created_at=env.created_at,
        updated_at=env.updated_at,
        configurations_count=len(env.configurations),
        drifts_count=env.drift_count,
        recent_drifts=[
            {
                "id": d.id,
                "category": d.category,
                "key": d.key,
                "expected": d.expected_value,
                "actual": d.actual_value,
                "severity": d.severity,
                "reason": d.reason,
                "status": d.status,
                "created_at": d.created_at.isoformat() if d.created_at else None,
            }
            for d in recent_drifts
        ],
        latest_deployment={
            "id": latest_dep.id,
            "version": latest_dep.config_version,
            "decision": latest_dep.decision,
            "reason": latest_dep.reason,
            "validated_at": latest_dep.validated_at.isoformat() if latest_dep.validated_at else None,
        } if latest_dep else None,
    )


@router.post("", response_model=EnvironmentResponse, status_code=status.HTTP_201_CREATED)
def create_environment(env_in: EnvironmentCreate, db: Session = Depends(get_db)):
    """Create a new environment entry."""
    normalized_name = env_in.name.lower().strip()
    existing = db.query(Environment).filter(Environment.name == normalized_name).first()
    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Environment '{env_in.name}' already exists"
        )

    env = Environment(
        name=normalized_name,
        display_name=env_in.display_name.strip(),
        status=env_in.status,
        config_version=env_in.config_version,
        deployment_status=env_in.deployment_status,
        drift_count=env_in.drift_count,
        critical_drift_count=env_in.critical_drift_count,
        created_at=datetime.utcnow(),
        updated_at=datetime.utcnow(),
    )
    db.add(env)
    db.commit()
    db.refresh(env)

    # Record audit log
    record_audit_log(
        db=db,
        action="ENVIRONMENT_CREATED",
        user="system",
        environment=env.name,
        environment_id=env.id,
        decision="APPROVED",
        reason=f"Created environment '{env.display_name}' ({env.name}) with version {env.config_version}."
    )

    return env


@router.patch("/{environment_id}", response_model=EnvironmentResponse)
def update_environment(
    environment_id: str,
    update_data: EnvironmentUpdate,
    db: Session = Depends(get_db)
):
    """Update fields on an existing environment."""
    env = find_environment(environment_id, db)
    if not env:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Environment '{environment_id}' not found"
        )

    updated_fields = []
    if update_data.display_name is not None:
        env.display_name = update_data.display_name.strip()
        updated_fields.append("display_name")
    if update_data.status is not None:
        env.status = update_data.status.strip()
        updated_fields.append("status")
    if update_data.config_version is not None:
        env.config_version = update_data.config_version
        updated_fields.append("config_version")
    if update_data.deployment_status is not None:
        env.deployment_status = update_data.deployment_status.strip()
        updated_fields.append("deployment_status")
    if update_data.drift_count is not None:
        env.drift_count = update_data.drift_count
        updated_fields.append("drift_count")
    if update_data.critical_drift_count is not None:
        env.critical_drift_count = update_data.critical_drift_count
        updated_fields.append("critical_drift_count")

    env.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(env)

    # Record audit log
    record_audit_log(
        db=db,
        action="ENVIRONMENT_UPDATED",
        user="system",
        environment=env.name,
        environment_id=env.id,
        decision="APPROVED",
        reason=f"Updated environment fields: {', '.join(updated_fields)}."
    )

    return env