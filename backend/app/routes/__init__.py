from backend.app.routes.health import router as health_router
from backend.app.routes.environments import router as environments_router
from backend.app.routes.configurations import configurations_router
from backend.app.routes.auth import auth_router
from backend.app.routes.audit_logs import audit_router
from backend.app.routes.settings import settings_router
from backend.app.routes.users import users_router
from backend.app.routes.validation import validation_router
from backend.app.routes.simulation import simulation_router
from backend.app.routes.deployments import deployments_router
from backend.app.routes.events import events_router
from backend.app.routes.dependencies import dependencies_router
from backend.app.routes.experiments import experiments_router
from backend.app.routes.notifications import notifications_router
from backend.app.routes.dashboard import dashboard_router
from backend.app.routes.operations import operations_router

__all__ = [
    "health_router",
    "environments_router",
    "configurations_router",
    "auth_router",
    "audit_router",
    "settings_router",
    "users_router",
    "validation_router",
    "simulation_router",
    "deployments_router",
    "events_router",
    "dependencies_router",
    "experiments_router",
    "notifications_router",
    "dashboard_router",
    "operations_router"
]

