import datetime
import json

from sqlalchemy import or_
from sqlalchemy.orm import joinedload

from src.db import (
    AccessEvent,
    NotificationDelivery,
    NotificationDevice,
    User,
    get_db,
)
from src.logger import logger


def _metadata_to_json(metadata):
    if metadata is None:
        return None
    return json.dumps(metadata, sort_keys=True)


def _metadata_from_json(metadata_json):
    if not metadata_json:
        return {}
    try:
        return json.loads(metadata_json)
    except json.JSONDecodeError:
        return {}


def _access_event_query(session):
    return session.query(AccessEvent).options(
        joinedload(AccessEvent.user).joinedload(User.apartment),
        joinedload(AccessEvent.actor_user),
        joinedload(AccessEvent.apartment),
    )


def _access_event_to_dict(event):
    user = event.user
    actor_user = event.actor_user
    apartment = event.apartment or (user.apartment if user and user.apartment else None)

    return {
        "id": event.id,
        "created_at": str(event.created_at),
        "method": event.method,
        "outcome": event.outcome,
        "user_id": event.user_id,
        "user_name": user.name if user else None,
        "user_email": user.email if user else None,
        "actor_user_id": event.actor_user_id,
        "actor_user_name": actor_user.name if actor_user else None,
        "credential_id": event.credential_id,
        "credential_label": event.credential_label,
        "apartment_id": event.apartment_id,
        "apartment_number": apartment.number if apartment else None,
        "reason": event.reason,
        "source": event.source,
        "metadata": _metadata_from_json(event.metadata_json),
    }


def save_access_event(
    method,
    outcome,
    user_id=None,
    actor_user_id=None,
    credential_id=None,
    credential_label=None,
    apartment_id=None,
    reason=None,
    source=None,
    metadata=None,
):
    with get_db() as db:
        event = AccessEvent(
            method=method,
            outcome=outcome,
            user_id=user_id,
            actor_user_id=actor_user_id,
            credential_id=credential_id,
            credential_label=credential_label,
            apartment_id=apartment_id,
            reason=reason,
            source=source,
            metadata_json=_metadata_to_json(metadata),
        )
        db.add(event)
        db.commit()
        event = _access_event_query(db).filter(AccessEvent.id == event.id).first()
        logger.info(
            "Access event recorded: method=%s outcome=%s user_id=%s actor_user_id=%s",
            method,
            outcome,
            user_id,
            actor_user_id,
        )
        return _access_event_to_dict(event)


def list_access_events(current_user, limit=50, user_id=None):
    bounded_limit = max(1, min(int(limit), 200))

    with get_db() as db:
        query = _access_event_query(db)
        role = getattr(current_user, "role", None)
        current_user_id = getattr(current_user, "id", None)

        if role == "admin":
            pass
        elif role == "apartment_admin":
            query = query.filter(
                AccessEvent.apartment_id == getattr(current_user, "apartment_id", None)
            )
        else:
            query = query.filter(
                or_(
                    AccessEvent.user_id == current_user_id,
                    AccessEvent.actor_user_id == current_user_id,
                )
            )

        if user_id is not None:
            query = query.filter(
                or_(AccessEvent.user_id == user_id, AccessEvent.actor_user_id == user_id)
            )

        events = (
            query.order_by(AccessEvent.created_at.desc(), AccessEvent.id.desc())
            .limit(bounded_limit)
            .all()
        )
        return [_access_event_to_dict(event) for event in events]


def get_access_event_summary(event_id):
    with get_db() as db:
        event = _access_event_query(db).filter(AccessEvent.id == event_id).first()
        if not event:
            return None
        return _access_event_to_dict(event)


def _notification_device_to_dict(device):
    return {
        "id": device.id,
        "user_id": device.user_id,
        "expo_push_token": device.expo_push_token,
        "platform": device.platform,
        "created_at": str(device.created_at),
        "updated_at": str(device.updated_at),
        "last_registered_at": str(device.last_registered_at),
        "is_active": device.is_active,
    }


def upsert_notification_device(user_id, expo_push_token, platform=None):
    now = datetime.datetime.utcnow()
    with get_db() as db:
        device = (
            db.query(NotificationDevice)
            .filter(NotificationDevice.expo_push_token == expo_push_token)
            .first()
        )
        if device:
            device.user_id = user_id
            device.platform = platform
            device.updated_at = now
            device.last_registered_at = now
            device.is_active = True
        else:
            device = NotificationDevice(
                user_id=user_id,
                expo_push_token=expo_push_token,
                platform=platform,
                created_at=now,
                updated_at=now,
                last_registered_at=now,
                is_active=True,
            )
            db.add(device)

        db.commit()
        db.refresh(device)
        logger.info("Notification device registered for user %s", user_id)
        return _notification_device_to_dict(device)


def deactivate_notification_device(expo_push_token, user_id=None):
    now = datetime.datetime.utcnow()
    with get_db() as db:
        query = db.query(NotificationDevice).filter(
            NotificationDevice.expo_push_token == expo_push_token
        )
        if user_id is not None:
            query = query.filter(NotificationDevice.user_id == user_id)
        device = query.first()
        if not device:
            return False
        device.is_active = False
        device.updated_at = now
        db.commit()
        logger.info("Notification device deactivated for user %s", device.user_id)
        return True


def get_active_notification_devices(user_id):
    with get_db() as db:
        devices = (
            db.query(NotificationDevice)
            .filter(
                NotificationDevice.user_id == user_id,
                NotificationDevice.is_active.is_(True),
            )
            .all()
        )
        return [_notification_device_to_dict(device) for device in devices]


def create_notification_delivery(access_event_id, user_id, notification_device_id):
    with get_db() as db:
        delivery = NotificationDelivery(
            access_event_id=access_event_id,
            user_id=user_id,
            notification_device_id=notification_device_id,
            status="queued",
        )
        db.add(delivery)
        db.commit()
        db.refresh(delivery)
        return delivery.id


def update_notification_delivery(delivery_id, status, expo_ticket_id=None, error=None):
    now = datetime.datetime.utcnow()
    with get_db() as db:
        delivery = (
            db.query(NotificationDelivery)
            .filter(NotificationDelivery.id == delivery_id)
            .first()
        )
        if not delivery:
            return False
        delivery.status = status
        delivery.expo_ticket_id = expo_ticket_id
        delivery.error = error
        delivery.updated_at = now
        db.commit()
        return True
