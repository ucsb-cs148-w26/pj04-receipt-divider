from pydantic import BaseModel, Field


class HealthCheckResponse(BaseModel):
    status: str = Field(serialization_alias="health-stauts")
