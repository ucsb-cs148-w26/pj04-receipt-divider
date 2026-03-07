"""
Local OCR integration tester.

Runs the full OCR + name-cleanup pipeline on every image in
backend/testing_images/ without needing a database or Supabase.

Run with:
    uv run pytest tests/local_receipt_test.py -v -s

Or as a standalone script:
    uv run python tests/local_receipt_test.py
"""

from __future__ import annotations

import asyncio
from pathlib import Path

from dotenv import load_dotenv

# Load .env so GOOGLE_API_KEY etc. are available during pytest runs
load_dotenv(Path(__file__).resolve().parent.parent / ".env")

import pytest

from app.services.ocr_service import OCRService, CleanedItem

TESTING_IMAGES_DIR = Path(__file__).resolve().parent.parent / "testing_images"
TEST_IMAGES = sorted(TESTING_IMAGES_DIR.glob("*.jpg")) + sorted(
    TESTING_IMAGES_DIR.glob("*.png")
)


def _print_results(image_path: Path, items: list[CleanedItem], receipt) -> None:
    print(f"\n{'=' * 70}")
    print(f"IMAGE: {image_path.name}")
    print(f"{'=' * 70}")
    print(f"  Items found: {len(items)}")
    print()
    for item in items:
        tax_flag = "[T]" if item.taxed else "   "
        original = (
            f"  (was: {item.original_name!r})"
            if item.original_name != item.name
            else ""
        )
        print(f"  {tax_flag}  ${item.unit_price:>7.2f}  {item.name}{original}")
    print()
    print(f"  Calculated subtotal: ${receipt.calculated_subtotal:.2f}")
    if receipt.ocr_subtotal is not None:
        print(f"  OCR subtotal:        ${receipt.ocr_subtotal:.2f}")
    if receipt.ocr_tax is not None:
        print(f"  OCR tax:             ${receipt.ocr_tax:.2f}")
    if receipt.ocr_total is not None:
        print(f"  OCR total:           ${receipt.ocr_total:.2f}")
    if receipt.confidence is not None:
        print(f"  Confidence:          {receipt.confidence.overall_score * 100:.0f}%")


# ── Pytest tests ──────────────────────────────────────────────────────────


@pytest.mark.skipif(not TEST_IMAGES, reason="No images found in testing_images/")
@pytest.mark.parametrize("image_path", TEST_IMAGES, ids=lambda p: p.name)
@pytest.mark.asyncio
async def test_ocr_extracts_items(image_path: Path):
    """OCR pipeline should extract at least one named item from each test image."""
    ocr = OCRService()
    image_bytes = image_path.read_bytes()

    items, receipt = await ocr.extract_items(image_bytes)

    _print_results(image_path, items, receipt)

    assert len(items) > 0, f"{image_path.name}: expected at least one item"
    for item in items:
        assert item.name.strip(), f"{image_path.name}: item has empty name"
        assert item.unit_price >= 0, f"{image_path.name}: negative unit price"


@pytest.mark.skipif(not TEST_IMAGES, reason="No images found in testing_images/")
@pytest.mark.parametrize("image_path", TEST_IMAGES, ids=lambda p: p.name)
@pytest.mark.asyncio
async def test_item_names_are_sentence_case(image_path: Path):
    """Cleaned item names should start with a capital letter (sentence case)."""
    ocr = OCRService()
    image_bytes = image_path.read_bytes()

    items, _ = await ocr.extract_items(image_bytes)

    for item in items:
        if item.name:
            first_char = item.name[0]
            assert first_char == first_char.upper() or not first_char.isalpha(), (
                f"Name {item.name!r} does not start with a capital letter"
            )


# ── Standalone runner ─────────────────────────────────────────────────────


async def _main():
    if not TEST_IMAGES:
        print(f"No images found in {TESTING_IMAGES_DIR}")
        return

    ocr = OCRService()
    for image_path in TEST_IMAGES:
        print(f"\nProcessing {image_path.name} ({image_path.stat().st_size} bytes)...")
        image_bytes = image_path.read_bytes()
        items, receipt = await ocr.extract_items(image_bytes)
        _print_results(image_path, items, receipt)


if __name__ == "__main__":
    asyncio.run(_main())
