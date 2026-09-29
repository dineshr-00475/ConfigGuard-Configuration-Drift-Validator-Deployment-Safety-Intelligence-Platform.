from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from backend.app.database.session import get_db
from backend.app.services.dependency_service import DependencyService

dependencies_router = APIRouter(prefix="/api/dependencies", tags=["Dependencies"])


@dependencies_router.get("/graph/{env_name}")
def get_dependency_graph(env_name: str, db: Session = Depends(get_db)):
    try:
        return DependencyService.get_dependency_graph(db, env_name)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
