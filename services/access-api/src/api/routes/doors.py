from fastapi import APIRouter, Depends, status
from ..models import User
from ..dependencies import get_current_user
from src.access_control import unlock_for_user

router = APIRouter(prefix="/doors", tags=["doors"])


@router.post("/unlock", status_code=status.HTTP_200_OK)
async def unlock_door(current_user: User = Depends(get_current_user)):
    return await unlock_for_user(current_user, source="app")
