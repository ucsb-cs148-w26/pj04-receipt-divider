from pydantic import BaseModel, ConfigDict
from pydantic.alias_generators import to_camel


class BaseRequest(BaseModel):
    model_config = ConfigDict(populate_by_name=False, alias_generator=to_camel)


class BaseResponse(BaseModel):
    model_config = ConfigDict(populate_by_name=True, alias_generator=to_camel)
