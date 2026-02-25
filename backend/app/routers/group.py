from fastapi import APIRouter, Query, Depends

from app.schemas.group import CreateGroupRequest, CreateGroupResponse
from app.dependencies import get_auth_service, get_user_service
from app.services.auth_service import AuthService
from app.services.user_service import UserService

router = APIRouter()


@router.post("/create", response_model=CreateGroupResponse)
def create_group(
    payload: CreateGroupRequest,
    auth_service: AuthService = Depends(get_auth_service),
    user_service: UserService = Depends(get_user_service),
):
    user_id = auth_service.authenticate_registered_user()
    group_id = user_service.create_group(user_id, payload.group_name)
    return CreateGroupResponse(group_id=group_id)


@router.get("/join")
def join_group(
    group_id: str,
    auth_service: AuthService = Depends(get_auth_service),
    user_service: UserService = Depends(get_user_service),
):
    user_id = auth_service.authenticate_any_user()
    user_service.join_group(user_id, group_id)

    return "OK"
