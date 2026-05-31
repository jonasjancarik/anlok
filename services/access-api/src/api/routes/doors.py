from fastapi import APIRouter, Depends, status
import src.utils as utils
from ..models import User
from ..dependencies import get_current_user
from ..exceptions import APIException
from src.door_manager import door_manager
from src.access_events import record_access_event

router = APIRouter(prefix="/doors", tags=["doors"])


@router.post("/unlock", status_code=status.HTTP_200_OK)
async def unlock_door(current_user: User = Depends(get_current_user)):
    if not getattr(current_user, "is_active", True):
        record_access_event(
            method="remote_unlock",
            outcome="denied",
            user_id=current_user.id,
            actor_user_id=current_user.id,
            apartment_id=getattr(current_user, "apartment_id", None),
            reason="inactive_user",
            source="app",
        )
        raise APIException(status_code=403, detail="Inactive users cannot unlock the door")

    record_access_event(
        method="remote_unlock",
        outcome="granted",
        user_id=current_user.id,
        actor_user_id=current_user.id,
        apartment_id=getattr(current_user, "apartment_id", None),
        source="app",
    )
    return await door_manager.unlock(utils.unlock_door, utils.RELAY_ACTIVATION_TIME)
