from fastapi import APIRouter, Depends, status

from ..dependencies import get_current_user
from ..models import (
    NotificationDeviceRegister,
    NotificationDeviceResponse,
    NotificationTestResponse,
    User,
)
from ..permissions import Permission, require_permission
import src.access_event_store as access_event_store
from src.notifications import send_test_notification

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
        push_token=registration.push_token,
        provider=registration.provider,
        platform=registration.platform,
        environment=registration.environment,
    )


@router.post(
    "/test",
    status_code=status.HTTP_200_OK,
    response_model=NotificationTestResponse,
)
@require_permission(Permission.NOTIFICATION_DEVICES_MANAGE_OWN)
def send_notification_test(current_user: User = Depends(get_current_user)):
    return send_test_notification(current_user.id)


@router.delete("/{push_token:path}", status_code=status.HTTP_204_NO_CONTENT)
@require_permission(Permission.NOTIFICATION_DEVICES_MANAGE_OWN)
def deactivate_notification_device(
    push_token: str,
    current_user: User = Depends(get_current_user),
):
    access_event_store.deactivate_notification_device(
        push_token, user_id=current_user.id
    )
    return None
