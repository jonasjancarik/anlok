import asyncio
import threading

import src.access_event_store as access_event_store
from src.logger import logger
from src.notifications import send_access_event_notifications


def _dispatch_notifications(access_event_id):
    try:
        loop = asyncio.get_running_loop()
    except RuntimeError:
        thread = threading.Thread(
            target=send_access_event_notifications,
            args=(access_event_id,),
            daemon=True,
        )
        thread.start()
        return

    loop.create_task(asyncio.to_thread(send_access_event_notifications, access_event_id))


def record_access_event(
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
    notify=True,
):
    try:
        event = access_event_store.save_access_event(
            method=method,
            outcome=outcome,
            user_id=user_id,
            actor_user_id=actor_user_id,
            credential_id=credential_id,
            credential_label=credential_label,
            apartment_id=apartment_id,
            reason=reason,
            source=source,
            metadata=metadata,
        )
    except Exception as error:
        logger.error("Failed to record access event: %s", error)
        return None

    if notify and event and event.get("user_id"):
        _dispatch_notifications(event["id"])

    return event
