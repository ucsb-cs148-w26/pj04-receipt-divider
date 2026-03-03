from pydantic import BaseModel, Field


class GetUserProfiesResponse(BaseModel):
    users_id: list[str] = Field(serialization_alias="usersId")


class LoginAsUserRequest(BaseModel):
    invite_token: str = Field(serialization_alias="inviteToken")
    user_id: str = Field(serialization_alias="userId")


class LoginAsUserResponse(BaseModel):
    access_token: str = Field(serialization_alias="accessToken")


class CreateUserProfileRequest(BaseModel):
    access_token: str = Field(serialization_alias="accessToken")
    name: str


class CreateGroupRequest(BaseModel):
    group_name: str = Field(alias="group-name", min_length=1, max_length=64)


class CreateGroupResponse(BaseModel):
    group_id: str = Field(serialization_alias="group-id")
