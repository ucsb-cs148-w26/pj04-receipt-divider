"""
OCR Service — entry point for receipt image processing.

Delegates to receipt_parser.detect for Vision API + line reconstruction,
then applies deterministic name cleanup to each extracted item.
"""

from __future__ import annotations

from dataclasses import dataclass

from app.services.receipt_parser.detect import detect_receipt
from app.services.receipt_parser.name_cleanup import clean_item_name
from app.services.receipt_parser.types import DebugReceipt


@dataclass
class CleanedItem:
    """A receipt item with its name cleaned up for display."""

    name: str
    original_name: str
    unit_price: float
    taxed: bool


class OCRService:
    """Service for extracting and cleaning receipt items from images."""

    async def extract_items(
        self, image_bytes: bytes
    ) -> tuple[list[CleanedItem], DebugReceipt]:
        """Run the full OCR + name-cleanup pipeline.

        Returns (cleaned_items, raw_debug_receipt).
        """
        receipt = await detect_receipt(image_bytes)

        cleaned: list[CleanedItem] = []
        for item in receipt.items:
            cleaned.append(
                CleanedItem(
                    name=clean_item_name(item.name, language=receipt.detected_language),
                    original_name=item.name,
                    unit_price=item.final_price,
                    taxed=item.taxed,
                )
            )

        return cleaned, receipt
