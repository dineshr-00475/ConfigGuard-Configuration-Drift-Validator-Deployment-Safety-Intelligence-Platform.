import time
from datetime import datetime
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from backend.app.database.session import engine, Base, SessionLocal
from backend.app.models.models import (
    Environment, SystemSetting, NotificationPreference, ValidationPolicy, DeploymentPolicy,
    PerformanceMetric, SystemErrorLog
)
from backend.app.routes import (
    health_router, environments_router, configurations_router, auth_router,
    audit_router, settings_router, users_router, validation_router,
    simulation_router, deployments_router, events_router,
    dependencies_router, experiments_router, notifications_router,
    dashboard_router, operations_router
)
from backend.app.routes.auth import seed_demo_users
from backend.app.database.seed_data import seed_complete_database
from backend.app.routes.operations import seed_operations_initial_data

# Initialize database schema
Base.metadata.create_all(bind=engine)


def seed_default_data():
    """Seed initial environments, demo users, configurations, and baseline states."""
    db = SessionLocal()
    try:
        # Seed users and settings
        seed_demo_users(db)
        if db.query(SystemSetting).count() == 0:
            db.add(SystemSetting())
        if db.query(NotificationPreference).count() == 0:
            db.add(NotificationPreference())
        if db.query(ValidationPolicy).count() == 0:
            db.add(ValidationPolicy())
        if db.query(DeploymentPolicy).count() == 0:
            db.add(DeploymentPolicy())
        db.commit()

        # Seed complete multi-layer environments, drifts, and baseline configurations
        seed_complete_database(db)
        # Seed incidents, change requests, pipelines, and initial performance telemetry
        seed_operations_initial_data(db)
    except Exception as e:
        db.rollback()
        print(f"Error seeding default data: {e}")
    finally:
        db.close()


# Run initial seed
seed_default_data()

app = FastAPI(
    title="ConfigGuard: Configuration Drift Validator & Deployment Safety Intelligence Platform",
    description="Mission-critical pre-deployment configuration drift detector, risk scoring engine, and gatekeeper for flash-sale e-commerce deployments",
    version="2.0.0"
)

# Enable CORS for local dev and preview environments
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.middleware("http")
async def record_api_timing_and_errors(request: Request, call_next):
    t0 = time.perf_counter()
    path = request.url.path
    try:
        response = await call_next(request)
        elapsed_ms = (time.perf_counter() - t0) * 1000.0
        if path.startswith("/api") and not path.startswith("/api/performance"):
            db = SessionLocal()
            try:
                db.add(
                    PerformanceMetric(
                        metric_type="API_REQUEST",
                        operation=f"{request.method} {path}",
                        duration_ms=round(max(0.05, elapsed_ms), 3),
                        success=response.status_code < 500,
                        status_code=response.status_code,
                        recorded_at=datetime.utcnow(),
                    )
                )
                if response.status_code >= 500:
                    db.add(
                        SystemErrorLog(
                            component="FastAPI HTTP Router",
                            endpoint=f"{request.method} {path}",
                            error_type=f"HTTP_{response.status_code}",
                            message=f"Server error status {response.status_code} returned for {path}",
                            severity="ERROR",
                            resolved=False,
                            occurred_at=datetime.utcnow(),
                        )
                    )
                db.commit()
            except Exception:
                db.rollback()
            finally:
                db.close()
        return response
    except Exception as exc:
        elapsed_ms = (time.perf_counter() - t0) * 1000.0
        db = SessionLocal()
        try:
            db.add(
                SystemErrorLog(
                    component="FastAPI Unhandled Exception",
                    endpoint=f"{request.method} {path}",
                    error_type=type(exc).__name__,
                    message=str(exc),
                    severity="CRITICAL",
                    resolved=False,
                    occurred_at=datetime.utcnow(),
                )
            )
            db.commit()
        except Exception:
            db.rollback()
        finally:
            db.close()
        raise


# Register all routes
app.include_router(health_router)
app.include_router(environments_router)
app.include_router(configurations_router)
app.include_router(auth_router)
app.include_router(audit_router)
app.include_router(settings_router)
app.include_router(users_router)
app.include_router(validation_router)
app.include_router(simulation_router)
app.include_router(deployments_router)
app.include_router(events_router)
app.include_router(dependencies_router)
app.include_router(experiments_router)
app.include_router(notifications_router)
app.include_router(dashboard_router)
app.include_router(operations_router)


@app.get("/health")
def health_root():
    return {
        "status": "healthy",
        "service": "ConfigGuard Deployment Safety Intelligence Platform",
        "database": "connected",
        "version": "2.0.0"
    }


@app.get("/")
def root():
    return {
        "app": "ConfigGuard",
        "status": "online",
        "version": "2.0.0",
        "docs": "/docs",
        "health": "/api/health",
        "dashboard": "/api/dashboard/metrics",
        "environments": "/api/environments",
        "validation": "/api/validation/run/{env_name}",
        "simulation": "/api/simulation/scenarios",
        "deployments": "/api/deployments",
        "dependencies": "/api/dependencies/graph/{env_name}",
        "benchmark": "/api/experiments/benchmark/latest",
        "notifications": "/api/notifications"
    }



if __name__ == "__main__":
    import uvicorn
    uvicorn.run("backend.app.main:app", host="0.0.0.0", port=8000, reload=True)
