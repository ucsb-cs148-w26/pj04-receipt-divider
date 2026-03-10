"""
Main receipt detection pipeline.
Calls Google Cloud Vision DOCUMENT_TEXT_DETECTION, reconstructs lines,
builds items, runs confidence checks.
Python port of detect.ts.
"""

from __future__ import annotations

import base64
import os
import time
from io import BytesIO
from typing import Optional

import httpx
from PIL import Image

from .algorithm import reconstruct_lines
from .types import ReceiptLine, ReceiptItem, TaxRateInfo, DebugReceipt
from .utils import parse_price, parse_tax_rate_line, extract_tax_code
from .checks import check_confidence
from .constants import MAX_IMAGE_DIMENSION
from .stores import determine_tax_groups


def _resize_image(image_bytes: bytes) -> bytes:
    """Resize image so the longest side is at most MAX_IMAGE_DIMENSION."""
    try:
        img = Image.open(BytesIO(image_bytes))
        w, h = img.size
        if max(w, h) <= MAX_IMAGE_DIMENSION:
            return image_bytes
        img.thumbnail(
            (MAX_IMAGE_DIMENSION, MAX_IMAGE_DIMENSION), Image.Resampling.LANCZOS
        )
        buf = BytesIO()
        fmt = img.format or "JPEG"
        img.save(buf, format=fmt)
        return buf.getvalue()
    except Exception:
        # Pillow can't open this format (e.g. HEIC) — pass bytes through
        # unchanged; Vision API handles most formats natively.
        return image_bytes


async def _call_vision_api(image_bytes: bytes) -> dict:
    """Call Google Cloud Vision DOCUMENT_TEXT_DETECTION."""
    api_key = os.environ.get("GOOGLE_API_KEY", "")
    url = os.environ.get(
        "GOOGLE_VISION_URL", "https://vision.googleapis.com/v1/images:annotate"
    )
    b64 = base64.b64encode(image_bytes).decode()

    payload = {
        "requests": [
            {
                "image": {"content": b64},
                "features": [{"type": "DOCUMENT_TEXT_DETECTION"}],
            }
        ]
    }

    async with httpx.AsyncClient(timeout=30) as client:
        resp = await client.post(f"{url}?key={api_key}", json=payload)
        resp.raise_for_status()
        data = resp.json()

    responses = data.get("responses", [])
    if not responses:
        raise RuntimeError("No response from Vision API")

    vision_resp = responses[0]

    # Vision API embeds per-image errors in the response body rather than HTTP status
    if "error" in vision_resp:
        err = vision_resp["error"]
        raise RuntimeError(
            f"Vision API error {err.get('code', '?')}: {err.get('message', err)}"
        )

    return vision_resp


def _extract_detected_language(vision_resp: dict) -> str:
    """Extract the dominant language code from the Vision API response.

    Looks at fullTextAnnotation.pages[0].property.detectedLanguages and
    returns the language code with the highest confidence.
    Falls back to 'en' if not available.
    """
    try:
        full_text = vision_resp.get("fullTextAnnotation", {})
        pages = full_text.get("pages", [])
        if not pages:
            return "en"
        prop = pages[0].get("property", {})
        langs = prop.get("detectedLanguages", [])
        if not langs:
            return "en"
        # Pick the language with the highest confidence
        best = max(langs, key=lambda lang: lang.get("confidence", 0))
        return best.get("languageCode", "en")
    except (KeyError, IndexError, TypeError):
        return "en"


def _build_items(lines: list[ReceiptLine]) -> list[ReceiptItem]:
    """Build list of ReceiptItems from classified lines, applying discounts."""
    items: list[ReceiptItem] = []
    visible = [ln for ln in lines if ln.line_type != "wrapped"]

    for line in visible:
        if line.line_type in ("untaxed_item", "taxed_item"):
            original_price = abs(parse_price(line.price))
            tax_code = extract_tax_code(line.price)
            items.append(
                ReceiptItem(
                    name=line.item_name or line.text,
                    original_price=original_price,
                    discount=0.0,
                    final_price=original_price,
                    taxed=line.line_type == "taxed_item",
                    tax_code=tax_code,
                    tax_rate=None,
                    raw_price=line.price or "",
                    raw_discount=None,
                )
            )
        elif line.line_type == "discount":
            discount_value = -abs(parse_price(line.price))
            if items:
                target = items[-1]
                target.discount += discount_value
                target.final_price = target.original_price + target.discount
                target.raw_discount = (
                    (target.raw_discount + ", " + (line.price or ""))
                    if target.raw_discount
                    else (line.price or "")
                )
    return items


async def detect_receipt(image_bytes: bytes) -> DebugReceipt:
    """
    Full pipeline: resize → Vision API → reconstruct lines → items → confidence.
    Returns a DebugReceipt with all parsed data.
    """
    start = time.time()

    # Resize
    resized = _resize_image(image_bytes)
    t1 = time.time()

    # OCR
    vision_resp = await _call_vision_api(resized)
    t2 = time.time()

    # Detect dominant language
    detected_language = _extract_detected_language(vision_resp)

    annotations = vision_resp.get("textAnnotations", [])
    if not annotations:
        keys = list(vision_resp.keys())
        raise RuntimeError(f"No text detected in image. Vision response keys: {keys}")

    # Reconstruct lines (skip first annotation = full text block)
    result = reconstruct_lines(annotations[1:])
    receipt_lines = result.lines
    angle = result.angle

    # Parse explicit tax rate breakdown lines
    all_tax_rates: list[TaxRateInfo] = []
    for line in receipt_lines:
        if line.line_type == "tax":
            info = parse_tax_rate_line(line.text, line.price)
            if info:
                all_tax_rates.append(
                    TaxRateInfo(
                        code=info["code"], rate=info["rate"], amount=info["amount"]
                    )
                )

    # Build items
    items = _build_items(receipt_lines)

    # OCR summary values
    ocr_subtotal: Optional[float] = None
    subs = [
        ln
        for ln in receipt_lines
        if ln.line_type == "subtotal" and ln.price is not None
    ]
    if subs:
        ocr_subtotal = parse_price(subs[-1].price)

    ocr_tax: Optional[float] = None
    tax_lines = [
        ln for ln in receipt_lines if ln.line_type == "tax" and ln.price is not None
    ]
    if tax_lines:
        if len(tax_lines) == 1:
            ocr_tax = parse_price(tax_lines[0].price)
        else:
            values = [parse_price(ln.price) for ln in tax_lines]
            max_val = max(values)
            non_max = [v for v in values if abs(v - max_val) >= 0.01]
            non_max_sum = sum(non_max)
            if non_max and abs(non_max_sum - max_val) < 0.02:
                ocr_tax = max_val
            else:
                ocr_tax = sum(values)

    ocr_total: Optional[float] = None
    total_line = next(
        (
            ln
            for ln in receipt_lines
            if ln.line_type == "total" and ln.price is not None
        ),
        None,
    )
    if total_line:
        ocr_total = parse_price(total_line.price)

    # Dynamic tax groups
    tax_result = determine_tax_groups(
        items, ocr_tax, ocr_subtotal, ocr_total, all_tax_rates
    )

    taxed_code_set = set(tax_result.taxed_codes)
    group_rate_map = {}
    for g in tax_result.groups:
        group_rate_map[g.code] = g.rate if g.taxed else None

    for item in items:
        code = item.tax_code or ""
        item.taxed = code in taxed_code_set
        item.tax_rate = group_rate_map.get(code)

    for line in receipt_lines:
        if line.line_type != "untaxed_item" or line.price is None:
            continue
        code = extract_tax_code(line.price) or ""
        if code in taxed_code_set:
            line.line_type = "taxed_item"

    # Compute stats
    untaxed = [i for i in items if not i.taxed]
    taxed = [i for i in items if i.taxed]
    untaxed_value = sum(i.final_price for i in untaxed)
    taxed_value = sum(i.final_price for i in taxed)
    tax_rate = tax_result.effective_tax_rate
    calculated_subtotal = untaxed_value + taxed_value

    # Tender amount
    tender_amount: Optional[float] = None
    for ln in receipt_lines:
        if ln.line_type != "tender" or ln.price is None:
            continue
        v = parse_price(ln.price)
        if v and (tender_amount is None or v > tender_amount):
            tender_amount = v

    # Confidence
    confidence = check_confidence(
        calculated_subtotal=calculated_subtotal,
        taxed_items_value=taxed_value,
        untaxed_items_value=untaxed_value,
        ocr_subtotal=ocr_subtotal,
        ocr_tax=ocr_tax,
        ocr_total=ocr_total,
        tax_rate=tax_rate,
        tender_amount=tender_amount,
        tax_rates=[
            TaxRateInfo(code=r.code, rate=r.rate, amount=r.amount)
            for r in tax_result.explicit_rates
        ],
        items=items,
    )

    t3 = time.time()

    total_lines = sum(1 for ln in receipt_lines if ln.line_type != "wrapped")

    return DebugReceipt(
        lines=receipt_lines,
        angle=angle,
        detected_store=None,
        items=items,
        total_lines=total_lines,
        total_items=len(items),
        total_untaxed_items=len(untaxed),
        total_taxed_items=len(taxed),
        untaxed_items_value=untaxed_value,
        taxed_items_value=taxed_value,
        ocr_subtotal=ocr_subtotal,
        ocr_tax=ocr_tax,
        ocr_total=ocr_total,
        calculated_subtotal=calculated_subtotal,
        tax_rate=tax_rate,
        tax_rates=all_tax_rates,
        tender_amount=tender_amount,
        confidence=confidence,
        times=[
            {"type": "Image resize", "elapsed": round((t1 - start) * 1000)},
            {"type": "OCR detection", "elapsed": round((t2 - t1) * 1000)},
            {"type": "Post-processing", "elapsed": round((t3 - t2) * 1000)},
        ],
        detected_language=detected_language,
    )
