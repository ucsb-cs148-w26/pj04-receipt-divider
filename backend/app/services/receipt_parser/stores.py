"""
Dynamic tax group determination for receipt parsing.
Python port of stores.ts.
"""

from __future__ import annotations

import re
from typing import Optional

from .types import ReceiptItem, TaxRateInfo

MAX_PLAUSIBLE_TAX_RATE = 0.15


class TaxGroup:
    __slots__ = ("code", "items", "total", "taxed", "rate")

    def __init__(self, code: str, items: list[ReceiptItem], total: float):
        self.code = code
        self.items = items
        self.total = total
        self.taxed = False
        self.rate: Optional[float] = None


class TaxGroupResult:
    __slots__ = ("groups", "taxed_codes", "effective_tax_rate", "explicit_rates")

    def __init__(
        self,
        groups: list[TaxGroup],
        taxed_codes: list[str],
        effective_tax_rate: Optional[float],
        explicit_rates: list[TaxRateInfo],
    ):
        self.groups = groups
        self.taxed_codes = taxed_codes
        self.effective_tax_rate = effective_tax_rate
        self.explicit_rates = explicit_rates


def _round_rate(raw: float) -> float:
    pct = raw * 100
    return round(pct / 0.05) * 0.05 / 100


def _find_best_rate(raw_rate: float, base: float, tax_amount: float) -> float:
    raw_bps = raw_rate * 10000

    bps_candidates = set()
    bps_candidates.add(round(raw_bps / 5) * 5)
    bps_candidates.add(int(raw_bps / 5) * 5)
    bps_candidates.add(-(-int(-raw_bps) // 5) * 5)  # ceil
    import math

    bps_candidates.add(math.floor(raw_bps / 5) * 5)
    bps_candidates.add(math.ceil(raw_bps / 5) * 5)
    bps_candidates.add(math.floor(raw_bps / 25) * 25)
    bps_candidates.add(math.ceil(raw_bps / 25) * 25)

    best_rate = _round_rate(raw_rate)
    best_score = float("inf")

    for bps in bps_candidates:
        if bps <= 0 or bps > MAX_PLAUSIBLE_TAX_RATE * 10000:
            continue
        rate = bps / 10000
        expected_tax = round(base * rate * 100) / 100
        residual = abs(expected_tax - tax_amount)
        dist25 = abs(bps - round(bps / 25) * 25)
        score = residual * 10000 + dist25
        if score < best_score:
            best_score = score
            best_rate = rate

    return best_rate


def _handle_explicit_rates(
    groups: list[TaxGroup], explicit_rates: list[TaxRateInfo]
) -> TaxGroupResult:
    taxed_codes: list[str] = []
    total_tax_amount = 0.0
    total_taxed_base = 0.0

    for rate_info in explicit_rates:
        group = next((g for g in groups if g.code == rate_info.code), None)
        if group:
            group.taxed = True
            group.rate = rate_info.rate
            taxed_codes.append(rate_info.code)
            total_tax_amount += rate_info.amount
            total_taxed_base += group.total

    effective = (
        _round_rate(total_tax_amount / total_taxed_base)
        if total_taxed_base > 0
        else None
    )

    return TaxGroupResult(
        groups=groups,
        taxed_codes=taxed_codes,
        effective_tax_rate=effective,
        explicit_rates=explicit_rates,
    )


def _try_match_numeric_rates(
    groups: list[TaxGroup], numeric_rates: list[TaxRateInfo]
) -> Optional[TaxGroupResult]:
    matches: dict[int, list[TaxRateInfo]] = {}  # group index -> rates

    for rate_info in numeric_rates:
        if rate_info.rate <= 0:
            continue
        expected_base = rate_info.amount / rate_info.rate

        best_group_idx: Optional[int] = None
        best_delta = float("inf")

        for gi, group in enumerate(groups):
            if group.total <= 0:
                continue
            delta = abs(group.total - expected_base) / max(group.total, expected_base)
            if delta < 0.03 and delta < best_delta:
                best_delta = delta
                best_group_idx = gi

        if best_group_idx is not None:
            matches.setdefault(best_group_idx, []).append(rate_info)
        else:
            return None

    taxed_codes: list[str] = []
    resolved_rates: list[TaxRateInfo] = []
    total_tax = 0.0
    total_base = 0.0

    for gi, rates in matches.items():
        group = groups[gi]
        group.taxed = True
        group.rate = sum(r.rate for r in rates)
        taxed_codes.append(group.code)
        group_tax = sum(r.amount for r in rates)
        total_tax += group_tax
        total_base += group.total

        for r in rates:
            resolved_rates.append(
                TaxRateInfo(code=group.code, rate=r.rate, amount=r.amount)
            )

    effective = _round_rate(total_tax / total_base) if total_base > 0 else None

    return TaxGroupResult(
        groups=groups,
        taxed_codes=taxed_codes,
        effective_tax_rate=effective,
        explicit_rates=resolved_rates,
    )


def _handle_single_tax_rate(
    groups: list[TaxGroup], tax_amount: float
) -> TaxGroupResult:
    if len(groups) == 1:
        group = groups[0]
        if group.total > 0:
            rate = _find_best_rate(tax_amount / group.total, group.total, tax_amount)
            if 0 < rate <= MAX_PLAUSIBLE_TAX_RATE:
                group.taxed = True
                group.rate = rate
                return TaxGroupResult(
                    groups=groups,
                    taxed_codes=[group.code],
                    effective_tax_rate=rate,
                    explicit_rates=[],
                )
        return TaxGroupResult(
            groups=groups, taxed_codes=[], effective_tax_rate=None, explicit_rates=[]
        )

    # Multiple groups: try all non-empty subsets
    group_arr = [g for g in groups if g.total > 0]
    n = len(group_arr)

    candidates = []

    for mask in range(1, 1 << n):
        subset_total = 0.0
        codes: list[str] = []
        for bit in range(n):
            if mask & (1 << bit):
                subset_total += group_arr[bit].total
                codes.append(group_arr[bit].code)

        if subset_total <= 0:
            continue

        raw_rate = tax_amount / subset_total
        if raw_rate <= 0 or raw_rate > MAX_PLAUSIBLE_TAX_RATE:
            continue

        rate = _find_best_rate(raw_rate, subset_total, tax_amount)
        if rate <= 0 or rate > MAX_PLAUSIBLE_TAX_RATE:
            continue

        expected_tax = round(subset_total * rate * 100) / 100
        residual = abs(expected_tax - tax_amount)

        rate_bps = round(rate * 10000)
        roundness025 = abs(rate_bps - round(rate_bps / 25) * 25) / 100

        candidates.append({
            "codes": codes,
            "rate": rate,
            "roundness": residual + roundness025 * 0.01,
        })

    if not candidates:
        return TaxGroupResult(
            groups=groups, taxed_codes=[], effective_tax_rate=None, explicit_rates=[]
        )

    candidates.sort(key=lambda c: c["roundness"])
    best = candidates[0]

    taxed_codes = best["codes"]
    for group in groups:
        if group.code in taxed_codes:
            group.taxed = True
            group.rate = best["rate"]

    return TaxGroupResult(
        groups=groups,
        taxed_codes=taxed_codes,
        effective_tax_rate=best["rate"],
        explicit_rates=[],
    )


# ── Main function ────────────────────────────────────────────────────────────


def determine_tax_groups(
    items: list[ReceiptItem],
    ocr_tax: Optional[float],
    ocr_subtotal: Optional[float],
    ocr_total: Optional[float],
    explicit_rates: list[TaxRateInfo],
) -> TaxGroupResult:
    # Step 1: group by tax code
    group_map: dict[str, list[ReceiptItem]] = {}
    for item in items:
        code = item.tax_code or ""
        group_map.setdefault(code, []).append(item)

    groups = [
        TaxGroup(
            code=code,
            items=group_items,
            total=sum(round(i.final_price * 100) / 100 for i in group_items),
        )
        for code, group_items in group_map.items()
    ]

    # Step 2: determine which are taxed
    tax_amount = ocr_tax
    if tax_amount is None and ocr_subtotal is not None and ocr_total is not None:
        implied = ocr_total - ocr_subtotal
        if implied > 0:
            tax_amount = implied

    letter_rates = [r for r in explicit_rates if re.match(r"^[A-Z]$", r.code, re.I)]
    numeric_rates = [
        r for r in explicit_rates if not re.match(r"^[A-Z]$", r.code, re.I)
    ]

    if letter_rates:
        return _handle_explicit_rates(groups, letter_rates)

    if numeric_rates:
        result = _try_match_numeric_rates(groups, numeric_rates)
        if result:
            return result

    if tax_amount is None or tax_amount <= 0:
        return TaxGroupResult(
            groups=groups, taxed_codes=[], effective_tax_rate=None, explicit_rates=[]
        )

    return _handle_single_tax_rate(groups, tax_amount)
