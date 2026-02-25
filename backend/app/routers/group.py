from fastapi import APIRouter, Depends

from app.dependencies import get_login_service
from app.schemas.group import (
    CreateUserProfileRequest,
    GetUserProfiesResponse,
    LoginAsUserRequest,
    LoginAsUserResponse,
)
from app.services import LoginService

router = APIRouter()


@router.get("/{group_id}/profile")
def get_user_profies(
    group_id: str,
    invite_token: str,
    login_service: LoginService = Depends(get_login_service),
):
    users_id = login_service.get_group_profiles_id(group_id, invite_token)
    return GetUserProfiesResponse(users_id=users_id)


@router.post("/{group_id}/login")
def login_user(
    group_id: str,
    payload: LoginAsUserRequest,
    login_service: LoginService = Depends(get_login_service),
):
    access_token = login_service.login_as(**payload.model_dump())
    return LoginAsUserResponse(access_token=access_token)


@router.post("./{group_id}/create-profile")
def create_user_profile(
    group_id: str,
    payload: CreateUserProfileRequest,
    login_service: LoginService = Depends(get_login_service),
):
    login_service.create_profile_and_login(
        group_id,
        payload.username,
        payload.access_token,
    )
