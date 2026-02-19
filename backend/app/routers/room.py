from fastapi import APIRouter, Query, Depends

from app.schemas.room import CreateRoomRequest
from app.dependencies import get_user_service

router = APIRouter()


@router.post("/join")
def join_room(
    payload: CreateRoomRequest,
    id: str = Query,
    user_service=Depends(get_user_service),
):
    # TODO: implement
    return "OK"


@router.post("/create")
def create_room():
    # TODO: implement
    return "OK"
