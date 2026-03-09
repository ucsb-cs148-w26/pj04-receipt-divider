import uuid
from pydantic import BaseModel, Field

from app.schemas.base import BaseRequest, BaseResponse


class CreateGroupRequest(BaseRequest):
    group_name: str = Field(min_length=1, max_length=64)


class CreateGroupResponse(BaseResponse):
    group_id: uuid.UUID


class DeleteReceiptRequest(BaseRequest):
    receipt_id: uuid.UUID


class CreateInviteLinkResponse(BaseResponse):
    url: str


class ProfileIdWithAccentColor(BaseModel):
    profile_id: uuid.UUID
    accent_color: str


class GetProfilesResponse(BaseResponse):
    profiles: list[ProfileIdWithAccentColor]


class CreateGuestProfileRequest(BaseRequest):
    group_id: uuid.UUID
    username: str


class CreateGuestProfileResponse(BaseResponse):
    access_token: str


class LoginAsRequest(BaseRequest):
    group_id: uuid.UUID
    profile_id: uuid.UUID


class LoginAsResponse(BaseResponse):
    access_token: str


class AddReceiptRequest(BaseRequest):
    group_id: uuid.UUID


class AddReceiptResponse(BaseResponse):
    receipt_id: uuid.UUID


class ClaimItemRequest(BaseRequest):
    item_id: uuid.UUID


class AssignItemRequest(BaseRequest):
    item_id: uuid.UUID
    guest_profile_id: uuid.UUID
