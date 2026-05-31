from fastapi import APIRouter, Depends, Query, status

from ..dependencies import get_current_user
from ..models import AccessEventResponse, User
from ..permissions import Permission, require_any_permission
import src.access_event_store as access_event_store

router = APIRouter(prefix="/access-events", tags=["access-events"])


@router.get(
    "",
    status_code=status.HTTP_200_OK,
    response_model=list[AccessEventResponse],
)
@require_any_permission(
    Permission.ACCESS_EVENTS_LIST_ALL,
    Permission.ACCESS_EVENTS_LIST_APARTMENT,
    Permission.ACCESS_EVENTS_VIEW_OWN,
)
def list_access_events(
    current_user: User = Depends(get_current_user),
    limit: int = Query(50, ge=1, le=200),
    user_id: int | None = Query(None),
):
    return access_event_store.list_access_events(
        current_user, limit=limit, user_id=user_id
    )
