import uuid

from fastapi import APIRouter, Depends, Form, HTTPException, status, UploadFile

from app.schemas.group import (
    AddReceiptResponse,
    AssignItemRequest,
    ClaimItemRequest,
    CreateGroupRequest,
    CreateGroupResponse,
    CreateGuestProfileRequest,
    CreateGuestProfileResponse,
    CreateInviteLinkResponse,
    DeleteReceiptRequest,
    GetProfilesResponse,
    LoginAsRequest,
    LoginAsResponse,
)
from app.dependencies import (
    get_auth_service,
    get_profile_service,
    get_user_service,
    get_invite_service,
)
from app.services.auth_service import AuthService
from app.services.invite_service import InviteService
from app.services.user_service import UserService
from app.services.profile_serivce import ProfileService
from app.services.profile_serivce import ProfileNotFoundError

router = APIRouter()


@router.post("/create", response_model=CreateGroupResponse)
def create_group(
    payload: CreateGroupRequest,
    auth_service: AuthService = Depends(get_auth_service),
    user_service: UserService = Depends(get_user_service),
):
    user_id = auth_service.authenticate_registered_user()
    group = user_service.create_group(user_id, payload.group_name)
    return CreateGroupResponse(group_id=group.id)


@router.get("/create-invite", response_model=CreateInviteLinkResponse)
def create_invite_link(
    group_id: str,
    auth_service: AuthService = Depends(get_auth_service),
    invite_service: InviteService = Depends(get_invite_service),
):
    profile_id = auth_service.authenticate_any_user()
    invite_url = invite_service.create_invite(group_id, profile_id)
    return CreateInviteLinkResponse(url=invite_url)


@router.get("/validate-invite", status_code=200)
def validate_invite(
    group_id: str, invite_service: InviteService = Depends(get_invite_service)
):
    is_valid = invite_service.validate_invite(group_id)
    if not is_valid:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND)
    return "OK"


@router.get("/profiles", response_model=GetProfilesResponse)
def get_profiles(
    group_id: str, profile_service: ProfileService = Depends(get_profile_service)
):
    profiles = profile_service.get_group_profiles_id_with_accent(group_id)
    return GetProfilesResponse(profiles=profiles)


@router.post("/profile-login", response_model=LoginAsResponse)
def login_as(
    payload: LoginAsRequest,
    profile_service: ProfileService = Depends(get_profile_service),
):
    try:
        token = profile_service.login_as(str(payload.group_id), str(payload.profile_id))
    except ProfileNotFoundError:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Profile not found in group"
        )
    return LoginAsResponse(access_token=token)


@router.post("/create-profile", response_model=CreateGuestProfileResponse)
def create_profile(
    payload: CreateGuestProfileRequest,
    profile_service: ProfileService = Depends(get_profile_service),
):
    token = profile_service.create_profile_and_login(
        str(payload.group_id), payload.username
    )
    return CreateGuestProfileResponse(access_token=token)


@router.post("/receipt/add", response_model=AddReceiptResponse)
async def add_receipt(
    group_id: uuid.UUID = Form(...),
    file: UploadFile = ...,
    auth_service: AuthService = Depends(get_auth_service),
    user_service: UserService = Depends(get_user_service),
):
    if file.content_type and not file.content_type.startswith("image/"):
        raise HTTPException(status_code=400, detail="File must be an image")

    image_bytes = await file.read()
    if not image_bytes:
        raise HTTPException(status_code=400, detail="Empty file")

    profile_id = auth_service.authenticate_any_user()

    filename = file.filename or ""
    image_ext = filename.rsplit(".", 1)[-1] if "." in filename else "jpg"

    receipt_id = await user_service.add_receipt(
        profile_id, str(group_id), image_bytes, image_ext
    )

    return AddReceiptResponse(receipt_id=receipt_id)


@router.delete("/receipt")
def remove_receipt(
    payload: DeleteReceiptRequest,
    auth_service: AuthService = Depends(get_auth_service),
    user_service: UserService = Depends(get_user_service),
):
    profile_id = auth_service.authenticate_any_user()
    user_service.remove_receipt(profile_id, str(payload.receipt_id))


@router.post("/item/claim")
def claim_item(
    payload: ClaimItemRequest,
    auth_service: AuthService = Depends(get_auth_service),
    user_service: UserService = Depends(get_user_service),
):
    profile_id = auth_service.authenticate_any_user()
    user_service.claim_item(profile_id, str(payload.item_id))


@router.post("/item/unclaim")
def unclaim_item(
    payload: ClaimItemRequest,
    auth_service: AuthService = Depends(get_auth_service),
    user_service: UserService = Depends(get_user_service),
):
    profile_id = auth_service.authenticate_any_user()
    user_service.unclaim_item(profile_id, str(payload.item_id))


@router.post("/item/assign")
def assign_item(
    payload: AssignItemRequest,
    auth_service: AuthService = Depends(get_auth_service),
    user_service: UserService = Depends(get_user_service),
):
    host_profile_id = auth_service.authenticate_any_user()
    user_service.assign_item(
        host_profile_id, str(payload.guest_profile_id), str(payload.item_id)
    )


@router.post("/item/unassign")
def unassign_item(
    payload: AssignItemRequest,
    auth_service: AuthService = Depends(get_auth_service),
    user_service: UserService = Depends(get_user_service),
):
    host_profile_id = auth_service.authenticate_any_user()
    user_service.unassign_item(
        host_profile_id, str(payload.guest_profile_id), str(payload.item_id)
    )
