import uuid
from pydantic import Field

from app.schemas.base import BaseRequest, BaseResponse


class CreateGroupRequest(BaseRequest):
    group_name: str = Field(min_length=1, max_length=64)


class CreateGroupResponse(BaseResponse):
    group_id: uuid.UUID


class DeleteReceiptRequest(BaseRequest):
    receipt_id: uuid.UUID


class CreateInviteLinkResponse(BaseResponse):
    url: str


class GetProfilesResponse(BaseResponse):
    profiles_id: list[uuid.UUID]


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
