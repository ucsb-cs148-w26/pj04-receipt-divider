import uuid
from typing import List, Optional
from pydantic import Field

from app.schemas.base import BaseRequest, BaseResponse


class CreateGroupRequest(BaseRequest):
    group_name: str = Field(min_length=1, max_length=64)


class CreateGroupResponse(BaseResponse):
    group_id: uuid.UUID


class DeleteReceiptRequest(BaseRequest):
    receipt_id: uuid.UUID


class UpdateReceiptOwnerRequest(BaseRequest):
    receipt_id: uuid.UUID
    new_owner_profile_id: uuid.UUID


class CreateInviteLinkResponse(BaseResponse):
    url: str


class PublicProfileData(BaseResponse):
    profile_id: uuid.UUID
    username: str
    accent_color: str
    is_guest: bool = False


class GetProfilesResponse(BaseResponse):
    profiles: list[PublicProfileData]
    group_created_by: uuid.UUID


class CreateGuestProfileRequest(BaseRequest):
    group_id: uuid.UUID
    username: str


class CreateGuestProfileResponse(BaseResponse):
    access_token: str


class RemoveMemberRequest(BaseRequest):
    group_id: uuid.UUID
    profile_id: uuid.UUID


class LoginAsRequest(BaseRequest):
    group_id: uuid.UUID
    profile_id: uuid.UUID


class LoginAsResponse(BaseResponse):
    access_token: str


class AddReceiptRequest(BaseRequest):
    group_id: uuid.UUID


class AddReceiptResponse(BaseResponse):
    receipt_id: uuid.UUID
    tax: Optional[float] = None
    ocr_total: Optional[float] = None
    confidence_score: Optional[float] = None
    warnings: Optional[list[str]] = None
    notes: Optional[list[str]] = None


class ClaimItemRequest(BaseRequest):
    item_id: uuid.UUID


class DeleteItemRequest(BaseRequest):
    item_id: uuid.UUID


class AssignItemRequest(BaseRequest):
    item_id: uuid.UUID
    guest_profile_id: uuid.UUID


class BulkAssignItemRequest(BaseRequest):
    item_ids: list[uuid.UUID]
    guest_profile_id: uuid.UUID


class UpdateItemRequest(BaseRequest):
    item_id: uuid.UUID
    name: Optional[str] = None
    unit_price: Optional[float] = None


class UpdateGroupNameRequest(BaseRequest):
    group_id: uuid.UUID
    group_name: str = Field(min_length=1, max_length=64)


class UpdateUsernameRequest(BaseRequest):
    username: str = Field(min_length=1, max_length=64)


class UpdateProfileColorRequest(BaseRequest):
    accent_color: str


class DeleteGroupRequest(BaseRequest):
    group_id: uuid.UUID


class GroupSummary(BaseResponse):
    group_id: uuid.UUID
    name: Optional[str]
    member_count: int
    total_claimed: float
    total_uploaded: float
    paid_status: str
    is_finished: bool = False
    all_members_paid: bool = False


class GetMyGroupsResponse(BaseResponse):
    groups: List[GroupSummary]


class JoinGroupRequest(BaseRequest):
    group_id: uuid.UUID


class AddItemRequest(BaseRequest):
    group_id: uuid.UUID
    receipt_id: Optional[uuid.UUID] = None
    name: str = ""
    unit_price: float = 0.0


class AddItemResponse(BaseResponse):
    item_id: uuid.UUID


class CreateManualReceiptRequest(BaseRequest):
    group_id: uuid.UUID
    tax: Optional[float] = None


class CreateManualReceiptResponse(BaseResponse):
    receipt_id: uuid.UUID


class UpdateReceiptTaxRequest(BaseRequest):
    receipt_id: uuid.UUID
    tax: Optional[float] = None


class UpdatePaidStatusRequest(BaseRequest):
    group_id: uuid.UUID
    profile_id: uuid.UUID
    paid_status: str  # 'verified' | 'pending' | 'requested' | 'unrequested'


class FinishGroupRequest(BaseRequest):
    group_id: uuid.UUID
