from pydantic import BaseModel


class ReceiptItemData(BaseModel):
    id: str
    name: str
    price: str
    userTags: list[int] = []
    discount: str = ""


class ReceiptAnalyzeRequest(BaseModel):
    image: str  # base64 encode


class ReceiptAnalyzeResponse(BaseModel):
    items: list[ReceiptItemData]
