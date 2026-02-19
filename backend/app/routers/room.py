from fastapi import APIRouter, HTTPException, Query, Depends

from app.schemas.room import CreateRoomRequest
from app.schemas.ocr_schema import ReceiptAnalyzeRequest, ReceiptAnalyzeResponse
from app.services.ocr_service import OCRService
from app.dependencies import get_user_service

router = APIRouter()


@router.post("/join")
def join_room(
    payload: CreateRoomRequest,
    id: str = Query,
    user_service=Depends(get_user_service),
):
    # TODO: implement
    return "OK"


@router.post("/create")
def create_room():
    # TODO: implement
    return "OK"


@router.post("/receipt/add", response_model=ReceiptAnalyzeResponse)
def add_receipt(request: ReceiptAnalyzeRequest):
    try:
        ocr_service = OCRService()
        items = ocr_service.extract_items(request.image)
        return ReceiptAnalyzeResponse(items=items)
    except Exception as e:
        print(f"Error adding receipt: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to add receipt: {str(e)}")
