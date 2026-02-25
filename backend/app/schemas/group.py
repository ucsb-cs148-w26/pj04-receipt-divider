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
