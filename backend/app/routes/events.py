from typing import Optional
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from backend.app.database.session import get_db
from backend.app.models.models import Event
from backend.app.schemas.schemas import EventPayloadRequest
from backend.app.services.event_engine import EventSafetyEngine

events_router = APIRouter(prefix="/api/events", tags=["Events"])


@events_router.post("")
def ingest_event(payload: EventPayloadRequest, db: Session = Depends(get_db)):
    try:
        return EventSafetyEngine.process_event(
            db=db,
            event_id=payload.event_id,
            environment_name=payload.environment,
            event_type=payload.event_type,
            version=payload.version,
            payload=payload.payload or {},
        )
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))


@events_router.get("/history")
def list_events(environment: Optional[str] = None, limit: int = 50, db: Session = Depends(get_db)):
    q = db.query(Event).order_by(Event.processed_at.desc())
    if environment:
        q = q.filter(Event.environment == environment)
    items = q.limit(limit).all()
    return [
        {
            "id": ev.id,
            "event_id": ev.event_id,
            "environment": ev.environment,
            "event_type": ev.event_type,
            "version": ev.version,
            "status": ev.status,
            "processed_at": ev.processed_at.isoformat() if ev.processed_at else None,
        }
        for ev in items
    ]
