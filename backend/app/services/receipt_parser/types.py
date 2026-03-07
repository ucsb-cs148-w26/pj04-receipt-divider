"""
Shared type definitions for the receipt OCR parser (Python port).
"""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Optional


@dataclass
class Point:
    x: float
    y: float


@dataclass
class WordBox:
    text: str
    center: Point
    left: float
    right: float
    top: float
    bottom: float
    width: float
    height: float
    vertices: list[Point]

    # We store the raw annotation dict for potential future use
    original: dict = field(default_factory=dict)


LineType = str  # one of: untaxed_item, taxed_item, discount, tax, total, subtotal, tender, info, wrapped


@dataclass
class ReceiptLine:
    words: list[WordBox]
    text: str
    item_name: Optional[str]
    price: Optional[str]
    line_type: LineType
    angle: float


@dataclass
class TaxRateInfo:
    code: str
    rate: float
    amount: float


@dataclass
class ReceiptItem:
    name: str
    original_price: float
    discount: float
    final_price: float
    taxed: bool
    tax_code: Optional[str]
    tax_rate: Optional[float]
    raw_price: str
    raw_discount: Optional[str]


@dataclass
class CheckResult:
    id: str
    severity: str  # 'info', 'warn', 'error'
    message: str
    penalty: float
    delta: Optional[float] = None


@dataclass
class ReceiptConfidence:
    total_minus_tax_equals_ocr_subtotal: Optional[bool]
    calculated_subtotal_equals_ocr_subtotal: Optional[bool]
    calculated_subtotal_equals_total_minus_tax: Optional[bool]
    checks: list[CheckResult]
    overall_score: float
    notes: list[str]
    warnings: list[str]


@dataclass
class Receipt:
    lines: list[ReceiptLine]
    angle: float
    detected_store: Optional[str]
    items: list[ReceiptItem]
    total_lines: int
    total_items: int
    total_untaxed_items: int
    total_taxed_items: int
    untaxed_items_value: float
    taxed_items_value: float
    ocr_subtotal: Optional[float]
    ocr_tax: Optional[float]
    ocr_total: Optional[float]
    calculated_subtotal: float
    tax_rate: Optional[float]
    tax_rates: list[TaxRateInfo]
    tender_amount: Optional[float]
    confidence: ReceiptConfidence


@dataclass
class DebugReceipt(Receipt):
    times: list[dict] = field(default_factory=list)


@dataclass
class ReconstructionResult:
    lines: list[ReceiptLine]
    angle: float
