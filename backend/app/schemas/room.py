from pydantic import BaseModel, Field


class CreateRoomRequest(BaseModel):
    user_id: str = Field(serialization_alias="user-id")
    # TODO: implement the rest
