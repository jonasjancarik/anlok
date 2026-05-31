from fastapi import APIRouter, Depends, status

from ..dependencies import get_current_user
from ..models import NotificationDeviceRegister, NotificationDeviceResponse, User
from ..permissions import Permission, require_permission
import src.access_event_store as access_event_store

router = APIRouter(prefix="/notification-devices", tags=["notification-devices"])


@router.post(
    "",
    status_code=status.HTTP_200_OK,
    response_model=NotificationDeviceResponse,
)
@require_permission(Permission.NOTIFICATION_DEVICES_MANAGE_OWN)
def register_notification_device(
    registration: NotificationDeviceRegister,
    current_user: User = Depends(get_current_user),
):
    return access_event_store.upsert_notification_device(
        user_id=current_user.id,
        expo_push_token=registration.expo_push_token,
        platform=registration.platform,
    )


@router.delete("/{expo_push_token}", status_code=status.HTTP_204_NO_CONTENT)
@require_permission(Permission.NOTIFICATION_DEVICES_MANAGE_OWN)
def deactivate_notification_device(
    expo_push_token: str,
    current_user: User = Depends(get_current_user),
):
    access_event_store.deactivate_notification_device(
        expo_push_token, user_id=current_user.id
    )
    return None
