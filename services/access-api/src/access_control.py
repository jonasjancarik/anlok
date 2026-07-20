"""Shared high-impact access operations used by REST and MCP."""

import src.utils as utils
from src.access_events import record_access_event
from src.api.exceptions import APIException
from src.door_manager import door_manager


async def unlock_for_user(current_user, *, source: str):
    if not getattr(current_user, "is_active", True):
        record_access_event(
            method="remote_unlock",
            outcome="denied",
            user_id=current_user.id,
            actor_user_id=current_user.id,
            apartment_id=getattr(current_user, "apartment_id", None),
            reason="inactive_user",
            source=source,
        )
        raise APIException(
            status_code=403, detail="Inactive users cannot unlock the door"
        )

    record_access_event(
        method="remote_unlock",
        outcome="granted",
        user_id=current_user.id,
        actor_user_id=current_user.id,
        apartment_id=getattr(current_user, "apartment_id", None),
        source=source,
    )
    return await door_manager.unlock(utils.unlock_door, utils.RELAY_ACTIVATION_TIME)
