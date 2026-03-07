"""
Test script: run the full receipt parser pipeline on a local image.
Usage: python -m test_receipt_parser
"""

import asyncio
import os
import sys

# Ensure the backend directory is on the path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

# Load .env
from dotenv import load_dotenv

load_dotenv(os.path.join(os.path.dirname(__file__), ".env"))

from app.services.receipt_parser.detect import detect_receipt


async def main():
    image_path = os.path.join(os.path.dirname(__file__), "tests", "normal_4.jpg")
    if not os.path.exists(image_path):
        print(f"Image not found: {image_path}")
        sys.exit(1)

    with open(image_path, "rb") as f:
        image_bytes = f.read()

    print(f"Processing {image_path} ({len(image_bytes)} bytes)...\n")

    receipt = await detect_receipt(image_bytes)

    # Print lines
    print("=" * 70)
    print("RECEIPT LINES")
    print("=" * 70)
    for i, line in enumerate(receipt.lines):
        if line.line_type == "wrapped":
            continue
        tag = line.line_type.upper()
        price_str = line.price or ""
        print(f"  [{tag:>14}]  {line.text:<50}  {price_str}")

    # Print items
    print()
    print("=" * 70)
    print("ITEMS")
    print("=" * 70)
    for item in receipt.items:
        tax_flag = "[T]" if item.taxed else "   "
        disc = f"  disc {item.discount:.2f}" if item.discount != 0 else ""
        code = f" ({item.tax_code})" if item.tax_code else ""
        print(f"  {tax_flag} ${item.final_price:>7.2f}  {item.name}{code}{disc}")

    # Print summary
    print()
    print("=" * 70)
    print("SUMMARY")
    print("=" * 70)
    print(f"  Total lines:        {receipt.total_lines}")
    print(f"  Total items:        {receipt.total_items}")
    print(
        f"  Untaxed items:      {receipt.total_untaxed_items} (${receipt.untaxed_items_value:.2f})"
    )
    print(
        f"  Taxed items:        {receipt.total_taxed_items} (${receipt.taxed_items_value:.2f})"
    )
    print(f"  Calculated subtotal: ${receipt.calculated_subtotal:.2f}")
    print(
        f"  OCR subtotal:       ${receipt.ocr_subtotal:.2f}"
        if receipt.ocr_subtotal is not None
        else "  OCR subtotal:       N/A"
    )
    print(
        f"  OCR tax:            ${receipt.ocr_tax:.2f}"
        if receipt.ocr_tax is not None
        else "  OCR tax:            N/A"
    )
    print(
        f"  OCR total:          ${receipt.ocr_total:.2f}"
        if receipt.ocr_total is not None
        else "  OCR total:          N/A"
    )
    print(
        f"  Tax rate:           {receipt.tax_rate * 100:.2f}%"
        if receipt.tax_rate is not None
        else "  Tax rate:           N/A"
    )
    print(
        f"  Tender amount:      ${receipt.tender_amount:.2f}"
        if receipt.tender_amount is not None
        else "  Tender amount:      N/A"
    )

    # Confidence
    print()
    print("=" * 70)
    print(f"CONFIDENCE: {receipt.confidence.overall_score * 100:.0f}%")
    print("=" * 70)
    for chk in receipt.confidence.checks:
        badge = "PASS" if chk.severity == "info" else chk.severity.upper()
        print(f"  [{badge:>4}] {chk.message}")

    # Timing
    print()
    print("=" * 70)
    print("TIMING")
    print("=" * 70)
    for t in receipt.times:
        print(f"  {t['type']}: {t['elapsed']}ms")

    print()
    print("Done!")


if __name__ == "__main__":
    asyncio.run(main())
