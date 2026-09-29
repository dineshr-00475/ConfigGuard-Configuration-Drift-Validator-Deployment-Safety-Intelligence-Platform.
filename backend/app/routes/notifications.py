from typing import List
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from backend.app.database.session import get_db
from backend.app.models.models import Notification
from backend.app.schemas.schemas import NotificationSchema

notifications_router = APIRouter(prefix="/api/notifications", tags=["System Notifications & Alerts"])


@notifications_router.get("", response_model=List[NotificationSchema])
def list_notifications(limit: int = 20, db: Session = Depends(get_db)):
    """List system alert notifications."""
    notes = db.query(Notification).order_by(Notification.id.desc()).limit(limit).all()
    return [NotificationSchema.model_validate(n) for n in notes]


@notifications_router.post("/{notification_id}/read")
def mark_notification_read(notification_id: int, db: Session = Depends(get_db)):
    """Mark a notification as read."""
    note = db.query(Notification).filter(Notification.id == notification_id).first()
    if not note:
        raise HTTPException(status_code=404, detail="Notification not found")
    note.is_read = True
    db.commit()
    return {"message": "Notification marked as read", "id": notification_id}


@notifications_router.post("/clear")
@notifications_router.post("/mark-all-read")
def clear_notifications(db: Session = Depends(get_db)):
    """Mark all notifications as read."""
    db.query(Notification).update({Notification.is_read: True})
    db.commit()
    return {"message": "All notifications marked as read"}
