"""
Pure utility functions used by the receipt-line reconstruction algorithm.
"""

from __future__ import annotations

import math
import re
from typing import Optional

from .types import Point, WordBox, LineType


# ── Conversion ───────────────────────────────────────────────────────────────


def annotation_to_word_box(ann: dict) -> WordBox:
    """Convert a Vision API word annotation dict into a WordBox."""
    raw_verts = ann.get("boundingPoly", {}).get("vertices", [])
    verts = [Point(x=v.get("x", 0), y=v.get("y", 0)) for v in raw_verts]

    xs = [v.x for v in verts] if verts else [0]
    ys = [v.y for v in verts] if verts else [0]

    left = min(xs)
    right = max(xs)
    top = min(ys)
    bottom = max(ys)

    return WordBox(
        text=ann.get("description", ""),
        center=Point(x=(left + right) / 2, y=(top + bottom) / 2),
        left=left,
        right=right,
        top=top,
        bottom=bottom,
        width=right - left,
        height=bottom - top,
        vertices=verts,
        original=ann,
    )


# ── Math helpers ─────────────────────────────────────────────────────────────


def median(values: list[float]) -> float:
    if not values:
        return 0.0
    s = sorted(values)
    mid = len(s) // 2
    if len(s) % 2 == 0:
        return (s[mid - 1] + s[mid]) / 2
    return s[mid]


def rotate_point(p: Point, angle: float, origin: Optional[Point] = None) -> Point:
    if origin is None:
        origin = Point(0, 0)
    cos_a = math.cos(angle)
    sin_a = math.sin(angle)
    dx = p.x - origin.x
    dy = p.y - origin.y
    return Point(
        x=origin.x + dx * cos_a - dy * sin_a, y=origin.y + dx * sin_a + dy * cos_a
    )


def angle_between(a: Point, b: Point) -> float:
    return math.atan2(b.y - a.y, b.x - a.x)


# ── Price detection ──────────────────────────────────────────────────────────

PRICE_REGEX = re.compile(
    r"^(?:"
    r"(?:-?\$?(?:\d{1,3}(?:,\d{3})*|\d+)\.\d{2,4})"
    r"|\.\d{2,4}"
    r"|\(\$?(?:\d{1,3}(?:,\d{3})*|\d+)\.\d{2,4}\)"
    r")(?:-(?![A-Z]))?(?:[ -][A-Z]{1,2})?$",
    re.IGNORECASE,
)


def is_price(text: str) -> bool:
    return bool(PRICE_REGEX.match(text.strip()))


def try_strip_tax_flag(text: str) -> Optional[str]:
    m = re.match(
        r"^[FNTXBOREP](\$?\d{0,3}(?:,\d{3})*\.\d{2})$", text.strip(), re.IGNORECASE
    )
    if m and is_price(m.group(1)):
        return m.group(1)
    return None


# ── Line classification ─────────────────────────────────────────────────────

SUBTOTAL_KEYWORDS = ["subtotal", "sub-total", "sub total", "net sales"]
TOTAL_KEYWORDS = ["total", "amount due", "balance", "grand total"]
TAX_KEYWORDS_RE = [
    re.compile(r"\btax[i\d]*\b", re.I),
    re.compile(r"\bhst\b", re.I),
    re.compile(r"\bgst\b", re.I),
    re.compile(r"\bpst\b", re.I),
    re.compile(r"\bvat\b", re.I),
    re.compile(r"\btex\b", re.I),
    re.compile(r"\bsales\s*tax\b", re.I),
]
DISCOUNT_KEYWORDS = ["disc", "discount", "off", "save", "savings", "coupon", "promo"]
DISCOUNT_KEYWORDS_PRICE = ["-"]
PAYMENT_KEYWORDS = [
    "visa",
    "mastercard",
    "master card",
    "amex",
    "american express",
    "discover",
    "debit",
    "change due",
    "bal due",
]
TENDER_KEYWORDS_RE = [
    re.compile(r"\btender\b", re.I),
    re.compile(r"\bcash\b", re.I),
    re.compile(r"\btendered\b", re.I),
    re.compile(r"\bamount tendered\b", re.I),
    re.compile(r"\bchange\b", re.I),
    re.compile(r"\btip\b", re.I),
    re.compile(r"\bgratuity\b", re.I),
    re.compile(r"\bservice charge\b", re.I),
    re.compile(r"\bapproved\b", re.I),
    re.compile(r"\bauth code\b", re.I),
    re.compile(r"\baid\s*:", re.I),
    re.compile(r"\bchip\b", re.I),
    re.compile(r"\bpaid\b", re.I),
    re.compile(r"\bpayment\b", re.I),
    re.compile(r"\bactivation\b", re.I),
    re.compile(r"\bredemption\b", re.I),
    re.compile(r"\btend\b", re.I),
    re.compile(r"\bfood\s+stamps?\b", re.I),
]


def classify_line(text: str, price: Optional[str]) -> LineType:
    lower = text.lower()

    if any(k in lower for k in SUBTOTAL_KEYWORDS):
        return "subtotal"

    if any(k in lower for k in TOTAL_KEYWORDS):
        if "number of" in lower:
            return "info"
        if "food stamps" in lower or "food stamp" in lower:
            return "info"
        if "ebt" in lower:
            return "info"
        if "cash balance" in lower:
            return "info"
        if "discounts" in lower:
            return "info"
        if re.search(r"\btotal\s+tax\b", lower):
            return "tax"
        if re.search(r"\btotal\s+savings?\b", lower):
            return "info"
        return "total"

    if re.search(r"\bvat\s*(no|number|reg)\b", lower):
        return "info"
    if re.search(r"\bvat\s+rate\b", lower):
        return "info"
    if re.search(r"\btax\s*invoice\b", lower):
        return "info"
    if any(r.search(lower) for r in TAX_KEYWORDS_RE):
        return "tax"
    if re.search(r"\bsave\s+money\b", lower):
        return "info"
    if any(k in lower for k in DISCOUNT_KEYWORDS):
        return "discount"
    if any(k in lower for k in PAYMENT_KEYWORDS):
        return "tender"
    if "sale price" in lower:
        return "info"
    if any(r.search(lower) for r in TENDER_KEYWORDS_RE):
        return "tender"
    if re.search(r"\btare\b", lower):
        return "info"
    if not price:
        return "info"
    if any(k in price for k in DISCOUNT_KEYWORDS_PRICE):
        return "discount"
    return "untaxed_item"


# ── Price value parsing ──────────────────────────────────────────────────────


def parse_price(raw: Optional[str]) -> float:
    if not raw:
        return 0.0
    s = raw.strip()

    has_parens = s.startswith("(") and ")" in s
    has_trailing_minus = bool(re.search(r"\d-", s))
    has_leading_minus = s.startswith("-")

    # Strip everything except digits, dots, and commas
    s = re.sub(r"[^0-9.,]", "", s)
    try:
        value = float(s.replace(",", ""))
    except ValueError:
        return 0.0
    if math.isnan(value):
        return 0.0

    return (
        -abs(value)
        if (has_parens or has_trailing_minus or has_leading_minus)
        else value
    )


# ── Tax rate line parsing ────────────────────────────────────────────────────


def parse_tax_rate_line(text: str, price: Optional[str]) -> Optional[dict]:
    if price is None:
        return None

    # Format 1: "A 8.50% TAX"
    m = re.search(r"\b([A-Z])\s+(\d+(?:\.\d+)?)%\s+TAX\b", text, re.I)
    if m:
        return {
            "code": m.group(1).upper(),
            "rate": float(m.group(2)) / 100,
            "amount": parse_price(price),
        }

    # Format 2: "TAX 1 7.900 %" or "TAX3 4.350 %"
    m = re.search(r"\bTAX\s*(\d+)\s+(\d+(?:\.\d+)?)\s*%", text, re.I)
    if m:
        return {
            "code": m.group(1),
            "rate": float(m.group(2)) / 100,
            "amount": parse_price(price),
        }

    # Format 3: "sales tax 9.125%"
    m = re.search(r"\bsales\s*tax\s+(\d+(?:\.\d+)?)\s*%", text, re.I)
    if m:
        return {
            "code": "",
            "rate": float(m.group(1)) / 100,
            "amount": parse_price(price),
        }

    return None


def extract_tax_code(price: Optional[str]) -> Optional[str]:
    if not price:
        return None
    m = re.search(r"[ -]([A-Z])$", price.strip(), re.I)
    return m.group(1).upper() if m else None
