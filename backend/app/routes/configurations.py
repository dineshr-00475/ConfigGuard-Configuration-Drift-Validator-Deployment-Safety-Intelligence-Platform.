from typing import List
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from backend.app.database.session import get_db
from backend.app.models.models import Environment, Configuration
from backend.app.schemas.schemas import (
    ConfigurationResponse,
    ConfigurationVersionResponse,
)

configurations_router = APIRouter(prefix="/api/configurations", tags=["Configurations"])


def get_environment_or_404(env_identifier: str, db: Session) -> Environment:
    env = None
    if env_identifier.isdigit():
        env = db.query(Environment).filter(Environment.id == int(env_identifier)).first()
    if not env:
        env = db.query(Environment).filter(Environment.name == env_identifier.lower().strip()).first()
    if not env:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Environment '{env_identifier}' not found"
        )
    return env


@configurations_router.get("/{environment}", response_model=ConfigurationResponse)
def get_environment_configuration(environment: str, db: Session = Depends(get_db)):
    """Retrieve the current active configuration for an environment."""
    env = get_environment_or_404(environment, db)

    # Find active configuration or latest version
    config = (
        db.query(Configuration)
        .filter(Configuration.environment_id == env.id, Configuration.is_active == True)
        .order_by(Configuration.version.desc())
        .first()
    )

    if not config:
        # Fallback to any latest configuration
        config = (
            db.query(Configuration)
            .filter(Configuration.environment_id == env.id)
            .order_by(Configuration.version.desc())
            .first()
        )

    if not config:
        # Create initial baseline configuration version
        config = Configuration(
            environment_id=env.id,
            version=env.config_version or 1,
            description=f"Initial baseline configuration for {env.display_name}",
            is_active=True,
            created_at=datetime.utcnow(),
        )
        db.add(config)
        db.commit()
        db.refresh(config)

    return ConfigurationResponse(
        id=config.id,
        environment=env.name,
        version=config.version,
        description=config.description,
        is_active=config.is_active,
        created_at=config.created_at,
    )


@configurations_router.get("/{environment}/versions", response_model=List[ConfigurationVersionResponse])
def get_environment_configuration_versions(environment: str, db: Session = Depends(get_db)):
    """Retrieve all historical configuration versions for an environment."""
    env = get_environment_or_404(environment, db)

    configs = (
        db.query(Configuration)
        .filter(Configuration.environment_id == env.id)
        .order_by(Configuration.version.desc())
        .all()
    )

    if not configs:
        # Ensure at least version 1 exists
        init_config = Configuration(
            environment_id=env.id,
            version=env.config_version or 1,
            description=f"Baseline configuration v{env.config_version or 1} for {env.display_name}",
            is_active=True,
            created_at=datetime.utcnow(),
        )
        db.add(init_config)
        db.commit()
        db.refresh(init_config)
        configs = [init_config]

    return [
        ConfigurationVersionResponse(
            version=c.version,
            environment=env.name,
            description=c.description,
            is_active=c.is_active,
            created_at=c.created_at,
        )
        for c in configs
    ]
