from pydantic import BaseModel, Field


class CreateGroupRequest(BaseModel):
    group_name: str = Field(alias="group-name")


class CreateGroupResponse(BaseModel):
    group_id: str = Field(serialization_alias="group-id")
