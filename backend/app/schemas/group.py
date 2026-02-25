from pydantic import BaseModel, Field


class CreateGroupRequest(BaseModel):
    group_name: str = Field(alias="group-name", min_length=1, max_length=64)


class CreateGroupResponse(BaseModel):
    group_id: str = Field(serialization_alias="group-id")
