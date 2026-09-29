import json
from datetime import datetime
from sqlalchemy.orm import Session
from backend.app.models.models import (
    Environment,
    Configuration,
    InfrastructureDefinition,
    EnvironmentVariable,
    SecretMetadata,
    RuntimeSnapshot,
    Deployment,
    AuditLog,
    Notification,
)
from backend.app.services.drift_engine import DriftDetectionEngine


def seed_complete_database(db: Session):
    existing_core = (
        db.query(Environment)
        .filter(Environment.name.in_(["development", "staging", "production"]))
        .count()
    )
    if existing_core >= 3:
        return

    envs_spec = [
        {
            "name": "development",
            "display_name": "Development",
            "status": "HEALTHY",
            "config_version": 12,
            "deployment_status": "APPROVED",
            "expected_infra": {"cpu": 2, "memory": "4Gi", "database": "db.t4g.medium", "replicas": 2, "max_connections": 200},
            "actual_infra": {"cpu": 2, "memory": "4Gi", "database": "db.t4g.medium", "replicas": 2, "max_connections": 200},
            "expected_vars": {
                "PAYMENT_MODE": "TEST",
                "PAYMENT_GATEWAY_URL": "https://sandbox.api.stripe-gateway.internal/v1",
                "FLASH_SALE_RATE_LIMITER_ENABLED": "true",
                "INVENTORY_CACHE_TTL_SEC": "30",
                "ORDER_QUEUE_CONCURRENCY": "20",
                "LOG_LEVEL": "debug",
            },
            "actual_vars": {
                "PAYMENT_MODE": "TEST",
                "PAYMENT_GATEWAY_URL": "https://sandbox.api.stripe-gateway.internal/v1",
                "FLASH_SALE_RATE_LIMITER_ENABLED": "true",
                "INVENTORY_CACHE_TTL_SEC": "30",
                "ORDER_QUEUE_CONCURRENCY": "20",
                "LOG_LEVEL": "debug",
            },
            "expected_secrets": [
                {"name": "STRIPE_API_SECRET", "version": 3, "status": "active"},
                {"name": "DB_MASTER_CREDENTIALS", "version": 2, "status": "active"},
                {"name": "JWT_SIGNING_KEY", "version": 4, "status": "active"},
            ],
            "actual_secrets": [
                {"name": "STRIPE_API_SECRET", "version": 3, "status": "active"},
                {"name": "DB_MASTER_CREDENTIALS", "version": 2, "status": "active"},
                {"name": "JWT_SIGNING_KEY", "version": 4, "status": "active"},
            ],
            "expected_runtime": {
                "service_status": "RUNNING",
                "api_url": "https://dev.api.flashsale.internal",
                "payment_mode": "TEST",
                "replicas": 2,
                "max_connections": 200,
            },
            "actual_runtime": {
                "service_status": "RUNNING",
                "api_url": "https://dev.api.flashsale.internal",
                "payment_mode": "TEST",
                "replicas": 2,
                "max_connections": 200,
            },
        },
        {
            "name": "staging",
            "display_name": "Staging",
            "status": "DRIFT_DETECTED",
            "config_version": 24,
            "deployment_status": "MANUAL_REVIEW",
            "expected_infra": {"cpu": 8, "memory": "16Gi", "database": "db.r6g.xlarge", "replicas": 6, "max_connections": 600},
            "actual_infra": {"cpu": 8, "memory": "16Gi", "database": "db.r6g.xlarge", "replicas": 6, "max_connections": 600},
            "expected_vars": {
                "PAYMENT_MODE": "TEST",
                "PAYMENT_GATEWAY_URL": "https://sandbox.api.stripe-gateway.internal/v1",
                "FLASH_SALE_RATE_LIMITER_ENABLED": "true",
                "INVENTORY_CACHE_TTL_SEC": "10",
                "ORDER_QUEUE_CONCURRENCY": "80",
                "LOG_LEVEL": "info",
            },
            "actual_vars": {
                "PAYMENT_MODE": "TEST",
                "PAYMENT_GATEWAY_URL": "https://sandbox.api.stripe-gateway.internal/v1",
                "FLASH_SALE_RATE_LIMITER_ENABLED": "true",
                "INVENTORY_CACHE_TTL_SEC": "180",
                "ORDER_QUEUE_CONCURRENCY": "80",
                "LOG_LEVEL": "debug",
            },
            "expected_secrets": [
                {"name": "STRIPE_API_SECRET", "version": 4, "status": "active"},
                {"name": "DB_MASTER_CREDENTIALS", "version": 3, "status": "active"},
                {"name": "JWT_SIGNING_KEY", "version": 5, "status": "active"},
            ],
            "actual_secrets": [
                {"name": "STRIPE_API_SECRET", "version": 4, "status": "active"},
                {"name": "DB_MASTER_CREDENTIALS", "version": 3, "status": "active"},
                {"name": "JWT_SIGNING_KEY", "version": 5, "status": "active"},
            ],
            "expected_runtime": {
                "service_status": "RUNNING",
                "api_url": "https://staging.api.flashsale.internal",
                "payment_mode": "TEST",
                "replicas": 6,
                "max_connections": 600,
            },
            "actual_runtime": {
                "service_status": "RUNNING",
                "api_url": "https://staging.api.flashsale.internal",
                "payment_mode": "TEST",
                "replicas": 6,
                "max_connections": 600,
            },
        },
        {
            "name": "production",
            "display_name": "Production",
            "status": "BLOCKED",
            "config_version": 42,
            "deployment_status": "BLOCKED",
            "expected_infra": {"cpu": 16, "memory": "64Gi", "database": "db.r6g.4xlarge", "replicas": 16, "max_connections": 1200},
            "actual_infra": {"cpu": 16, "memory": "64Gi", "database": "db.r6g.4xlarge", "replicas": 6, "max_connections": 300},
            "expected_vars": {
                "PAYMENT_MODE": "LIVE",
                "PAYMENT_GATEWAY_URL": "https://live.api.stripe-gateway.internal/v1",
                "FLASH_SALE_RATE_LIMITER_ENABLED": "true",
                "INVENTORY_CACHE_TTL_SEC": "5",
                "ORDER_QUEUE_CONCURRENCY": "150",
                "LOG_LEVEL": "warn",
            },
            "actual_vars": {
                "PAYMENT_MODE": "TEST",
                "PAYMENT_GATEWAY_URL": "https://sandbox.api.stripe-gateway.internal/v1",
                "FLASH_SALE_RATE_LIMITER_ENABLED": "false",
                "INVENTORY_CACHE_TTL_SEC": "120",
                "ORDER_QUEUE_CONCURRENCY": "40",
                "LOG_LEVEL": "debug",
            },
            "expected_secrets": [
                {"name": "STRIPE_API_SECRET", "version": 5, "status": "active"},
                {"name": "DB_MASTER_CREDENTIALS", "version": 4, "status": "active"},
                {"name": "JWT_SIGNING_KEY", "version": 6, "status": "active"},
            ],
            "actual_secrets": [
                {"name": "STRIPE_API_SECRET", "version": 4, "status": "deprecated"},
                {"name": "DB_MASTER_CREDENTIALS", "version": 4, "status": "active"},
                {"name": "JWT_SIGNING_KEY", "version": 6, "status": "active"},
            ],
            "expected_runtime": {
                "service_status": "RUNNING",
                "api_url": "https://live.api.stripe-gateway.internal/v1",
                "payment_mode": "LIVE",
                "replicas": 16,
                "max_connections": 1200,
            },
            "actual_runtime": {
                "service_status": "RUNNING",
                "api_url": "https://sandbox.api.stripe-gateway.internal/v1",
                "payment_mode": "TEST",
                "replicas": 6,
                "max_connections": 300,
            },
        },
    ]

    for spec in envs_spec:
        if db.query(Environment).filter(Environment.name == spec["name"]).first():
            continue
        env = Environment(
            name=spec["name"],
            display_name=spec["display_name"],
            status=spec["status"],
            config_version=spec["config_version"],
            deployment_status=spec["deployment_status"],
            last_validation_time=datetime.utcnow(),
        )
        db.add(env)
        db.flush()

        db.add(
            Configuration(
                environment_id=env.id,
                version=spec["config_version"],
                description=f"Golden baseline configuration for {spec['display_name']}",
                is_active=True,
                is_safe=spec["name"] == "development",
                author="GitOps Controller",
                comment="Initial seeded baseline",
                config_data_json=json.dumps(
                    {
                        "infrastructure": spec["expected_infra"],
                        "env_variables": spec["expected_vars"],
                        "secrets": spec["expected_secrets"],
                    }
                ),
            )
        )

        for is_actual, infra in [(False, spec["expected_infra"]), (True, spec["actual_infra"])]:
            db.add(
                InfrastructureDefinition(
                    environment_id=env.id,
                    is_actual=is_actual,
                    cpu=infra["cpu"],
                    memory=infra["memory"],
                    database=infra["database"],
                    replicas=infra["replicas"],
                    max_connections=infra["max_connections"],
                    raw_json=json.dumps({"read_replica_enabled": True}),
                )
            )

        for is_actual, env_vars in [(False, spec["expected_vars"]), (True, spec["actual_vars"])]:
            for k, v in env_vars.items():
                db.add(EnvironmentVariable(environment_id=env.id, key=k, value=str(v), is_actual=is_actual))

        for is_actual, sec_list in [(False, spec["expected_secrets"]), (True, spec["actual_secrets"])]:
            for sec in sec_list:
                db.add(
                    SecretMetadata(
                        environment_id=env.id,
                        name=sec["name"],
                        version=sec["version"],
                        status=sec["status"],
                        is_actual=is_actual,
                    )
                )

        for rt in [spec["expected_runtime"], spec["actual_runtime"]]:
            db.add(
                RuntimeSnapshot(
                    environment_id=env.id,
                    api_url=rt["api_url"],
                    payment_mode=rt["payment_mode"],
                    replicas=rt["replicas"],
                    max_connections=rt["max_connections"],
                    raw_json=json.dumps({"service_status": rt.get("service_status", "RUNNING")}),
                )
            )

    db.commit()

    for env_name in ["development", "staging", "production"]:
        try:
            DriftDetectionEngine.run_full_validation(db, env_name, triggered_by="system-bootstrap")
        except Exception:
            pass
