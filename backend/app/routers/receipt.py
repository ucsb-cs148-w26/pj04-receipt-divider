from fastapi import APIRouter, HTTPException

from app.schemas.receipt import ReceiptAnalyzeRequest, ReceiptAnalyzeResponse
from app.services.ocr_service import OCRService

router = APIRouter()


@router.post("/analyze", response_model=ReceiptAnalyzeResponse)
def analyze_receipt(request: ReceiptAnalyzeRequest):
    """
    Analyze a receipt image and extract items

    Args:
        request: Contains base64 encoded image

    Returns:
        List of extracted receipt items
    """
    try:
        ocr_service = OCRService()
        items = ocr_service.extract_items(request.image)

        return ReceiptAnalyzeResponse(items=items)

    except Exception as e:
        print(f"Error analyzing receipt: {e}")
        raise HTTPException(
            status_code=500, detail=f"Failed to analyze receipt: {str(e)}"
        )
