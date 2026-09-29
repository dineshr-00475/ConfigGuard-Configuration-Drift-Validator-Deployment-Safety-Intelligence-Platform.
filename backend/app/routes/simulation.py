from typing import List, Dict, Any, Optional
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from backend.app.database.session import get_db
from backend.app.models.models import SimulationRecord, User
from backend.app.schemas.schemas import (
    ScenarioInfoSchema, InjectScenarioRequest, WhatIfSimulationRequest,
    WhatIfSimulationResponse
)
from backend.app.services.simulation_service import FailureSimulationService
from backend.app.routes.auth import get_optional_current_user

simulation_router = APIRouter(prefix="/api/simulation", tags=["Simulation & What-If Center"])


@simulation_router.get("/scenarios", response_model=List[ScenarioInfoSchema])
def list_scenarios():
    """List all available failure simulation scenarios."""
    scenarios = FailureSimulationService.get_available_scenarios()
    return [ScenarioInfoSchema(**s) for s in scenarios]


@simulation_router.post("/inject")
def inject_scenario(
    req: InjectScenarioRequest,
    user: Optional[User] = Depends(get_optional_current_user),
    db: Session = Depends(get_db)
):
    """Inject a failure scenario into target environment actual state and trigger gatekeeper."""
    operator = user.email if user else "Chaos Engineering Team"
    try:
        result = FailureSimulationService.inject_scenario(db, req.scenario_key, req.environment, operator)
        return result
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@simulation_router.post("/recover/{env_name}")
def recover_environment(
    env_name: str,
    user: Optional[User] = Depends(get_optional_current_user),
    db: Session = Depends(get_db)
):
    """Recover environment actual configuration back to baseline invariants."""
    operator = user.email if user else "System Operator"
    try:
        result = FailureSimulationService.recover_environment(db, env_name, operator)
        return result
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@simulation_router.post("/what-if", response_model=WhatIfSimulationResponse)
def simulate_what_if(
    req: WhatIfSimulationRequest,
    db: Session = Depends(get_db)
):
    """
    Simulate hypothetical configuration modifications without changing production data.
    Computes expected drift, simulated risk score, risk level, and gatekeeper decision.
    """
    try:
        result = FailureSimulationService.simulate_what_if(db, req.environment, req.modifications)
        return WhatIfSimulationResponse(**result)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@simulation_router.get("/history")
def get_simulation_history(db: Session = Depends(get_db)):
    """Retrieve history of injected simulations and recovery events."""
    recs = db.query(SimulationRecord).order_by(SimulationRecord.id.desc()).limit(20).all()
    return [
        {
            "id": r.id,
            "scenario_key": r.scenario_key,
            "title": r.title,
            "environment_name": r.environment_name,
            "severity": r.severity,
            "status": r.status,
            "injected_by": r.injected_by,
            "injected_at": r.injected_at.isoformat() if r.injected_at else None,
            "recovered_at": r.recovered_at.isoformat() if r.recovered_at else None
        }
        for r in recs
    ]
