import uuid

from fastapi import APIRouter, Depends, Form, HTTPException, status, UploadFile

from app.schemas.group import (
    AddItemRequest,
    AddItemResponse,
    AddReceiptResponse,
    AssignItemRequest,
    BulkAssignItemRequest,
    ClaimItemRequest,
    CreateManualReceiptRequest,
    CreateManualReceiptResponse,
    DeleteItemRequest,
    CreateGroupRequest,
    CreateGroupResponse,
    CreateGuestProfileRequest,
    CreateGuestProfileResponse,
    CreateInviteLinkResponse,
    DeleteGroupRequest,
    DeleteReceiptRequest,
    FinishGroupRequest,
    GetMyGroupsResponse,
    GetProfilesResponse,
    GroupSummary,
    JoinGroupRequest,
    LoginAsRequest,
    LoginAsResponse,
    RemoveMemberRequest,
    UpdateItemRequest,
    UpdateGroupNameRequest,
    UpdateProfileColorRequest,
    UpdateUsernameRequest,
    UpdateReceiptTaxRequest,
    UpdateReceiptOwnerRequest,
    UpdatePaidStatusRequest,
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


@router.get("/my-groups", response_model=GetMyGroupsResponse)
def get_my_groups(
    auth_service: AuthService = Depends(get_auth_service),
    user_service: UserService = Depends(get_user_service),
):
    profile_id = auth_service.authenticate_registered_user()
    rows = user_service.get_groups_summary(profile_id)
    summaries = [
        GroupSummary(
            group_id=row.id,
            name=row.name,
            member_count=row.member_count,
            total_claimed=float(row.total_claimed),
            total_uploaded=float(row.total_uploaded),
            paid_status=row.paid_status,
            is_finished=bool(row.is_finished),
            all_members_paid=row.outstanding_count == 0,
        )
        for row in rows
    ]
    return GetMyGroupsResponse(groups=summaries)


@router.get("/create-invite", response_model=CreateInviteLinkResponse)
def create_invite_link(
    group_id: str,
    auth_service: AuthService = Depends(get_auth_service),
    invite_service: InviteService = Depends(get_invite_service),
):
    profile_id = auth_service.authenticate_any_user()
    invite_url = invite_service.create_invite(group_id, profile_id)
    return CreateInviteLinkResponse(url=invite_url)


@router.post("/join", status_code=200)
def join_group(
    payload: JoinGroupRequest,
    auth_service: AuthService = Depends(get_auth_service),
    user_service: UserService = Depends(get_user_service),
):
    profile_id = auth_service.authenticate_registered_user()
    user_service.join_group(profile_id, str(payload.group_id))


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
    profiles, group_created_by = profile_service.get_profiles_data_by_group(group_id)
    return GetProfilesResponse(profiles=profiles, group_created_by=group_created_by)


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

    receipt_id, tax, ocr_total, confidence = await user_service.add_receipt(
        profile_id, str(group_id), image_bytes, image_ext
    )

    return AddReceiptResponse(
        receipt_id=receipt_id,
        tax=tax,
        ocr_total=ocr_total,
        confidence_score=confidence.overall_score if confidence else None,
        warnings=confidence.warnings if confidence else None,
        notes=confidence.notes if confidence else None,
    )


@router.delete("/member")
def remove_member(
    payload: RemoveMemberRequest,
    auth_service: AuthService = Depends(get_auth_service),
    user_service: UserService = Depends(get_user_service),
):
    host_profile_id = auth_service.authenticate_registered_user()
    user_service.remove_guest_member(
        host_profile_id, str(payload.group_id), str(payload.profile_id)
    )


@router.delete("/receipt")
def remove_receipt(
    payload: DeleteReceiptRequest,
    auth_service: AuthService = Depends(get_auth_service),
    user_service: UserService = Depends(get_user_service),
):
    profile_id = auth_service.authenticate_any_user()
    user_service.remove_receipt(profile_id, str(payload.receipt_id))


@router.delete("/item")
def delete_item(
    payload: DeleteItemRequest,
    auth_service: AuthService = Depends(get_auth_service),
    user_service: UserService = Depends(get_user_service),
):
    profile_id = auth_service.authenticate_any_user()
    user_service.delete_item(profile_id, str(payload.item_id))


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


@router.post("/item/assign-bulk")
def assign_items_bulk(
    payload: BulkAssignItemRequest,
    auth_service: AuthService = Depends(get_auth_service),
    user_service: UserService = Depends(get_user_service),
):
    host_profile_id = auth_service.authenticate_any_user()
    user_service.assign_items(
        host_profile_id,
        str(payload.guest_profile_id),
        [str(i) for i in payload.item_ids],
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


@router.post("/item/unassign-bulk")
def unassign_items_bulk(
    payload: BulkAssignItemRequest,
    auth_service: AuthService = Depends(get_auth_service),
    user_service: UserService = Depends(get_user_service),
):
    host_profile_id = auth_service.authenticate_any_user()
    user_service.unassign_items(
        host_profile_id,
        str(payload.guest_profile_id),
        [str(i) for i in payload.item_ids],
    )


@router.patch("/item")
def update_item(
    payload: UpdateItemRequest,
    auth_service: AuthService = Depends(get_auth_service),
    user_service: UserService = Depends(get_user_service),
):
    profile_id = auth_service.authenticate_any_user()
    user_service.update_item(
        profile_id, str(payload.item_id), payload.name, payload.unit_price
    )


@router.patch("/name")
def update_group_name(
    payload: UpdateGroupNameRequest,
    auth_service: AuthService = Depends(get_auth_service),
    user_service: UserService = Depends(get_user_service),
):
    profile_id = auth_service.authenticate_any_user()
    user_service.update_group_name(
        profile_id, str(payload.group_id), payload.group_name
    )


@router.patch("/finish")
def finish_group(
    payload: FinishGroupRequest,
    auth_service: AuthService = Depends(get_auth_service),
    user_service: UserService = Depends(get_user_service),
):
    profile_id = auth_service.authenticate_registered_user()
    user_service.finish_group(profile_id, str(payload.group_id))


@router.patch("/profile/username")
def update_username(
    payload: UpdateUsernameRequest,
    auth_service: AuthService = Depends(get_auth_service),
    profile_service: ProfileService = Depends(get_profile_service),
):
    profile_id = auth_service.authenticate_any_user()
    profile_service.update_username(profile_id, payload.username)
    return "OK"


@router.patch("/profile/color")
def update_profile_color(
    payload: UpdateProfileColorRequest,
    auth_service: AuthService = Depends(get_auth_service),
    profile_service: ProfileService = Depends(get_profile_service),
):
    profile_id = auth_service.authenticate_any_user()
    profile_service.update_color(profile_id, payload.accent_color)
    return "OK"


@router.delete("/delete")
def delete_group(
    payload: DeleteGroupRequest,
    auth_service: AuthService = Depends(get_auth_service),
    user_service: UserService = Depends(get_user_service),
):
    profile_id = auth_service.authenticate_any_user()
    user_service.delete_group(profile_id, str(payload.group_id))


@router.post("/item/add", response_model=AddItemResponse)
def add_item_manual(
    payload: AddItemRequest,
    auth_service: AuthService = Depends(get_auth_service),
    user_service: UserService = Depends(get_user_service),
):
    profile_id = auth_service.authenticate_any_user()
    item_id = user_service.add_item(
        profile_id,
        str(payload.group_id),
        str(payload.receipt_id) if payload.receipt_id else None,
        payload.name,
        payload.unit_price,
    )
    return AddItemResponse(item_id=item_id)


@router.post("/receipt/manual", response_model=CreateManualReceiptResponse)
def create_manual_receipt(
    payload: CreateManualReceiptRequest,
    auth_service: AuthService = Depends(get_auth_service),
    user_service: UserService = Depends(get_user_service),
):
    profile_id = auth_service.authenticate_any_user()
    receipt_id = user_service.create_manual_receipt(
        profile_id, str(payload.group_id), payload.tax
    )
    return CreateManualReceiptResponse(receipt_id=receipt_id)


@router.patch("/receipt/owner")
def change_receipt_owner(
    payload: UpdateReceiptOwnerRequest,
    auth_service: AuthService = Depends(get_auth_service),
    user_service: UserService = Depends(get_user_service),
):
    profile_id = auth_service.authenticate_any_user()
    user_service.update_receipt_owner(
        profile_id, str(payload.receipt_id), str(payload.new_owner_profile_id)
    )


@router.patch("/receipt/tax")
def update_receipt_tax(
    payload: UpdateReceiptTaxRequest,
    auth_service: AuthService = Depends(get_auth_service),
    user_service: UserService = Depends(get_user_service),
):
    profile_id = auth_service.authenticate_any_user()
    user_service.update_receipt_tax(profile_id, str(payload.receipt_id), payload.tax)


@router.patch("/paid-status")
def update_paid_status(
    payload: UpdatePaidStatusRequest,
    auth_service: AuthService = Depends(get_auth_service),
    user_service: UserService = Depends(get_user_service),
):
    caller_id = auth_service.authenticate_any_user()
    user_service.update_paid_status(
        caller_id, str(payload.group_id), str(payload.profile_id), payload.paid_status
    )
