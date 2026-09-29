from datetime import datetime
import json
import time
from typing import Dict, Any, Tuple
from sqlalchemy.orm import Session
from backend.app.models.models import Event, Environment, AuditLog, PerformanceMetric


class EventSafetyEngine:
    @staticmethod
    def process_event(
        db: Session,
        event_id: str,
        environment_name: str,
        event_type: str,
        version: int,
        payload: Dict[str, Any],
        operator_name: str = "Event Ingestion Pipeline"
    ) -> Dict[str, Any]:
        """
        Process configuration and deployment events safely.
        Enforces idempotency, deduplication, and strictly rejects out-of-order / stale events.
        """
        t_ev_start = time.perf_counter()
        env = db.query(Environment).filter(Environment.name == environment_name).first()
        if not env:
            raise ValueError(f"Environment '{environment_name}' not found")

        # 1. Idempotency / Duplicate check
        existing_event = db.query(Event).filter(Event.event_id == event_id).first()
        if existing_event:
            dur_ms = max(0.05, (time.perf_counter() - t_ev_start) * 1000.0)
            db.add(PerformanceMetric(
                metric_type="EVENT_PROCESSING",
                operation=f"event_duplicate:{event_type}",
                environment=environment_name,
                duration_ms=round(dur_ms, 3),
                success=True,
                recorded_at=datetime.utcnow()
            ))
            db.commit()
            return {
                "status": "IGNORED_DUPLICATE",
                "event_id": event_id,
                "version": version,
                "action": "IGNORED",
                "message": f"Idempotency barrier triggered: Event {event_id} was already processed at {existing_event.processed_at.isoformat()}.",
                "processed_at": datetime.utcnow()
            }

        # 2. Out-of-order / Stale version check
        if version <= env.config_version:
            # Stale / Out of order
            rejected_event = Event(
                event_id=event_id,
                environment=environment_name,
                event_type=event_type,
                version=version,
                payload_json=json.dumps(payload),
                status="REJECTED_OLD_VERSION",
                timestamp=datetime.utcnow(),
                processed_at=datetime.utcnow()
            )
            db.add(rejected_event)
            dur_ms = max(0.05, (time.perf_counter() - t_ev_start) * 1000.0)
            db.add(PerformanceMetric(
                metric_type="EVENT_PROCESSING",
                operation=f"event_rejected:{event_type}",
                environment=environment_name,
                duration_ms=round(dur_ms, 3),
                success=False,
                recorded_at=datetime.utcnow()
            ))
            db.commit()

            return {
                "status": "REJECTED_OLD_VERSION",
                "event_id": event_id,
                "version": version,
                "action": "REJECTED",
                "message": f"Out-of-order safety barrier: Event version v{version} is <= active environment version v{env.config_version}.",
                "processed_at": datetime.utcnow()
            }

        # 3. Valid newer version -> Process event
        new_event = Event(
            event_id=event_id,
            environment=environment_name,
            event_type=event_type,
            version=version,
            payload_json=json.dumps(payload),
            status="PROCESSED",
            timestamp=datetime.utcnow(),
            processed_at=datetime.utcnow()
        )

        db.add(new_event)

        # Increment environment version
        env.config_version = version
        env.updated_at = datetime.utcnow()

        audit = AuditLog(
            environment_id=env.id,
            environment_name=environment_name,
            action="EVENT_PROCESSED_VERSION_SYNC",
            user=operator_name,
            decision="APPROVED",
            reason=f"Event {event_id} ({event_type}) applied. Upgraded {environment_name} configuration version to v{version}.",
            timestamp=datetime.utcnow()
        )
        db.add(audit)
        dur_ms = max(0.05, (time.perf_counter() - t_ev_start) * 1000.0)
        db.add(PerformanceMetric(
            metric_type="EVENT_PROCESSING",
            operation=f"event_processed:{event_type}",
            environment=environment_name,
            duration_ms=round(dur_ms, 3),
            success=True,
            recorded_at=datetime.utcnow()
        ))
        db.commit()

        return {
            "status": "PROCESSED",
            "event_id": event_id,
            "version": version,
            "action": "SYNCHRONIZED",
            "message": f"Event {event_id} successfully processed. Environment version advanced to v{version}.",
            "processed_at": datetime.utcnow()
        }
