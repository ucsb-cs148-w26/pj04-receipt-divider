import traceback

from fastapi import APIRouter, UploadFile, File, HTTPException

from app.services.receipt_parser.detect import detect_receipt

router = APIRouter()


def _build_suggestions(receipt) -> list[dict]:
    """Build user-facing suggestions based on confidence checks (same as reference repo)."""
    suggestions = []
    conf = receipt.confidence

    for c in conf.checks:
        if c.severity == "info":
            continue

        if c.id == "calc_subtotal_vs_ocr_subtotal" and c.delta and c.delta > 0:
            suggestions.append({
                "type": "warning",
                "message": c.message,
                "suggestion": (
                    "Some items may not have been detected. "
                    "Try retaking the photo with better lighting and ensure the entire receipt is visible."
                ),
            })
        elif c.id == "missing_item_estimate":
            suggestions.append({
                "type": "warning",
                "message": c.message,
                "suggestion": (
                    "The subtotal suggests a missing item. "
                    "Check if any items were cut off at the edges of the photo."
                ),
            })
        elif c.id == "missing_discount_estimate":
            suggestions.append({
                "type": "warning",
                "message": c.message,
                "suggestion": (
                    "The subtotal suggests an extra item was included or a discount is missing. "
                    "Review the items list and remove any that don't belong."
                ),
            })
        elif c.id == "missing_total":
            suggestions.append({
                "type": "warning",
                "message": c.message,
                "suggestion": (
                    "No TOTAL line was found. Make sure the bottom of the receipt is fully visible in the photo."
                ),
            })
        elif c.id == "missing_subtotal":
            suggestions.append({
                "type": "info",
                "message": c.message,
                "suggestion": (
                    "No SUBTOTAL line was found. Accuracy may be reduced — "
                    "ensure the full receipt is captured."
                ),
            })
        elif c.id.startswith("tax_consistency"):
            suggestions.append({
                "type": "warning",
                "message": c.message,
                "suggestion": (
                    "Tax calculation doesn't match. This can happen with per-item rounding or "
                    "if some taxed items weren't detected correctly."
                ),
            })
        elif c.id == "total_eq_subtotal_plus_tax" and c.severity == "error":
            suggestions.append({
                "type": "error",
                "message": c.message,
                "suggestion": (
                    "The receipt totals are inconsistent. "
                    "This may indicate a partially visible or damaged receipt. "
                    "Try retaking the photo."
                ),
            })
        elif c.id == "taxability_balance" and c.severity in ("warn", "error"):
            suggestions.append({
                "type": "warning",
                "message": c.message,
                "suggestion": (
                    "The taxed/untaxed item split doesn't match the subtotal. "
                    "Some items may have been miscategorized."
                ),
            })
        else:
            suggestions.append({
                "type": c.severity,
                "message": c.message,
                "suggestion": "Review the scanned items for accuracy.",
            })

    return suggestions


@router.post("/scan")
async def scan_receipt(file: UploadFile = File(...)):
    if file.content_type and not file.content_type.startswith("image/"):
        raise HTTPException(status_code=400, detail="File must be an image")

    image_bytes = await file.read()
    if not image_bytes:
        raise HTTPException(status_code=400, detail="Empty file")

    try:
        receipt = await detect_receipt(image_bytes)
    except Exception as e:
        traceback.print_exc()
        raise HTTPException(status_code=422, detail=f"Failed to parse receipt: {e}")

    items = [
        {
            "name": item.name,
            "originalPrice": item.original_price,
            "discount": item.discount,
            "finalPrice": item.final_price,
            "taxed": item.taxed,
            "taxCode": item.tax_code,
            "taxRate": item.tax_rate,
            "rawPrice": item.raw_price,
        }
        for item in receipt.items
    ]

    return {
        "items": items,
        "totalLines": receipt.total_lines,
        "totalItems": receipt.total_items,
        "untaxedItemsValue": receipt.untaxed_items_value,
        "taxedItemsValue": receipt.taxed_items_value,
        "calculatedSubtotal": receipt.calculated_subtotal,
        "ocrSubtotal": receipt.ocr_subtotal,
        "ocrTax": receipt.ocr_tax,
        "ocrTotal": receipt.ocr_total,
        "taxRate": receipt.tax_rate,
        "confidence": receipt.confidence.overall_score,
        "checks": [
            {"id": c.id, "severity": c.severity, "message": c.message}
            for c in receipt.confidence.checks
        ],
        "warnings": receipt.confidence.warnings,
        "suggestions": _build_suggestions(receipt),
    }
