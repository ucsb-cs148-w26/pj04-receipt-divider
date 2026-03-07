"""
Composable confidence-check pipeline for receipt price validation.
Python port of checks.ts.
"""

from __future__ import annotations

import math
from typing import Optional

from .types import CheckResult, ReceiptConfidence, ReceiptItem, TaxRateInfo

CENTS_TOLERANCE = 0.015
MAX_PLAUSIBLE_TAX_RATE = 0.15


def _approx_equal(a: float, b: float) -> bool:
    return abs(a - b) < CENTS_TOLERANCE


# ── Check context ────────────────────────────────────────────────────────────


class CheckContext:
    __slots__ = (
        "calculated_subtotal",
        "taxed_items_value",
        "untaxed_items_value",
        "ocr_subtotal",
        "ocr_tax",
        "ocr_total",
        "tax_rate",
        "tax_rates",
        "items",
        "tender_amount",
    )

    def __init__(
        self,
        calculated_subtotal: float,
        taxed_items_value: float,
        untaxed_items_value: float,
        ocr_subtotal: Optional[float],
        ocr_tax: Optional[float],
        ocr_total: Optional[float],
        tax_rate: Optional[float],
        tax_rates: list[TaxRateInfo] | None = None,
        items: list[ReceiptItem] | None = None,
        tender_amount: Optional[float] = None,
    ):
        self.calculated_subtotal = calculated_subtotal
        self.taxed_items_value = taxed_items_value
        self.untaxed_items_value = untaxed_items_value
        self.ocr_subtotal = ocr_subtotal
        self.ocr_tax = ocr_tax
        self.ocr_total = ocr_total
        self.tax_rate = tax_rate
        self.tax_rates = tax_rates or []
        self.items = items or []
        self.tender_amount = tender_amount


# ── Individual checks ────────────────────────────────────────────────────────


def _check_total_eq_subtotal_plus_tax(ctx: CheckContext) -> Optional[CheckResult]:
    if ctx.ocr_total is None or ctx.ocr_subtotal is None or ctx.ocr_tax is None:
        return None
    expected = ctx.ocr_subtotal + ctx.ocr_tax
    delta = abs(ctx.ocr_total - expected)
    ok = delta < CENTS_TOLERANCE

    is_service = (
        not ok
        and ctx.tender_amount is not None
        and ctx.tender_amount < ctx.ocr_total * 0.9
        and abs(delta - ctx.tender_amount) < CENTS_TOLERANCE
    )

    return CheckResult(
        id="total_eq_subtotal_plus_tax",
        severity="info" if (ok or is_service) else "error",
        message=(
            f"TOTAL (${ctx.ocr_total:.2f}) = SUBTOTAL (${ctx.ocr_subtotal:.2f}) + TAX (${ctx.ocr_tax:.2f})"
            if ok
            else f"TOTAL (${ctx.ocr_total:.2f}) != SUBTOTAL (${ctx.ocr_subtotal:.2f}) + TAX (${ctx.ocr_tax:.2f}) — off by ${delta:.2f}"
        ),
        delta=delta,
        penalty=0 if (ok or is_service) else 10 + delta * 100,
    )


def _check_taxability_balance(ctx: CheckContext) -> Optional[CheckResult]:
    reference = ctx.ocr_subtotal
    if reference is None and ctx.ocr_total is not None and ctx.ocr_tax is not None:
        reference = ctx.ocr_total - ctx.ocr_tax
    if reference is None:
        return None
    items_sum = ctx.taxed_items_value + ctx.untaxed_items_value
    delta = abs(items_sum - reference)
    ok = delta < CENTS_TOLERANCE
    return CheckResult(
        id="taxability_balance",
        severity="info" if ok else ("error" if delta > 1 else "warn"),
        message=(
            f"Taxed (${ctx.taxed_items_value:.2f}) + Untaxed (${ctx.untaxed_items_value:.2f}) = reference subtotal (${reference:.2f})"
            if ok
            else f"Taxed (${ctx.taxed_items_value:.2f}) + Untaxed (${ctx.untaxed_items_value:.2f}) = ${items_sum:.2f} != reference subtotal (${reference:.2f}) — off by ${delta:.2f}"
        ),
        delta=delta,
        penalty=0 if ok else 5 + delta * 50,
    )


def _check_calc_subtotal_vs_ocr(ctx: CheckContext) -> Optional[CheckResult]:
    if ctx.ocr_subtotal is None:
        return None
    delta = abs(ctx.calculated_subtotal - ctx.ocr_subtotal)
    ok = delta < CENTS_TOLERANCE
    direction = "less" if ctx.calculated_subtotal < ctx.ocr_subtotal else "more"
    return CheckResult(
        id="calc_subtotal_vs_ocr_subtotal",
        severity="info" if ok else ("error" if delta > 5 else "warn"),
        message=(
            f"Calculated subtotal (${ctx.calculated_subtotal:.2f}) matches OCR SUBTOTAL (${ctx.ocr_subtotal:.2f})"
            if ok
            else f"Calculated subtotal (${ctx.calculated_subtotal:.2f}) is ${delta:.2f} {direction} than OCR SUBTOTAL (${ctx.ocr_subtotal:.2f})"
        ),
        delta=delta,
        penalty=0 if ok else 8 + delta * 80,
    )


def _check_calc_subtotal_vs_total_minus_tax(ctx: CheckContext) -> Optional[CheckResult]:
    if ctx.ocr_total is None:
        return None
    reference = (
        ctx.ocr_total - ctx.ocr_tax if ctx.ocr_tax is not None else ctx.ocr_total
    )
    delta = abs(ctx.calculated_subtotal - reference)
    ok = delta < CENTS_TOLERANCE
    direction = "less" if ctx.calculated_subtotal < reference else "more"

    penalty = 0.0 if ok else 8 + delta * 80
    if (
        not ok
        and ctx.ocr_tax is None
        and ctx.calculated_subtotal > 0
        and ctx.calculated_subtotal < ctx.ocr_total
    ):
        implied_rate = (
            ctx.ocr_total - ctx.calculated_subtotal
        ) / ctx.calculated_subtotal
        if 0 < implied_rate <= 0.15:
            penalty = 0

    is_service = (
        not ok
        and ctx.tender_amount is not None
        and ctx.ocr_total is not None
        and ctx.tender_amount < ctx.ocr_total * 0.9
        and abs(delta - ctx.tender_amount) < CENTS_TOLERANCE
    )
    if is_service:
        penalty = 0

    return CheckResult(
        id="calc_subtotal_vs_total_minus_tax",
        severity="info"
        if (ok or is_service or penalty == 0)
        else ("error" if delta > 5 else "warn"),
        message=(
            f"Calculated subtotal (${ctx.calculated_subtotal:.2f}) matches TOTAL-TAX (${reference:.2f})"
            if ok
            else f"Calculated subtotal (${ctx.calculated_subtotal:.2f}) is ${delta:.2f} {direction} than TOTAL-TAX (${reference:.2f})"
        ),
        delta=delta,
        penalty=penalty,
    )


def _check_tax_consistency(ctx: CheckContext) -> Optional[CheckResult]:
    if ctx.tax_rates:
        return None
    if ctx.ocr_tax is None or ctx.tax_rate is None or ctx.taxed_items_value <= 0:
        return None
    expected_tax = round(ctx.taxed_items_value * ctx.tax_rate * 100) / 100
    delta = abs(ctx.ocr_tax - expected_tax)
    ok = delta < CENTS_TOLERANCE
    per_line_rounding = not ok and delta <= 0.05
    return CheckResult(
        id="tax_consistency",
        severity="info"
        if (ok or per_line_rounding)
        else ("error" if delta > 0.1 else "warn"),
        message=(
            f"OCR TAX (${ctx.ocr_tax:.2f}) ~= taxed items (${ctx.taxed_items_value:.2f}) x rate ({ctx.tax_rate * 100:.2f}%) = ${expected_tax:.2f}"
            if ok
            else f"OCR TAX (${ctx.ocr_tax:.2f}) != taxed items (${ctx.taxed_items_value:.2f}) x rate ({ctx.tax_rate * 100:.2f}%) = ${expected_tax:.2f} — off by ${delta:.2f}"
        ),
        delta=delta,
        penalty=0 if (ok or per_line_rounding) else 3 + delta * 200,
    )


def _check_per_code_tax_consistency(ctx: CheckContext) -> list[CheckResult]:
    if not ctx.tax_rates:
        return []
    results = []
    for tr in ctx.tax_rates:
        code_items = [i for i in ctx.items if (i.tax_code or "") == tr.code]
        code_base = sum(i.final_price for i in code_items)
        if code_base <= 0:
            results.append(
                CheckResult(
                    id=f"tax_consistency_{tr.code}",
                    severity="warn",
                    message=f"Tax code {tr.code}: no items found with this code, but receipt shows ${tr.amount:.2f} tax",
                    penalty=2,
                )
            )
            continue
        expected_tax = round(code_base * tr.rate * 100) / 100
        delta = abs(tr.amount - expected_tax)
        ok = delta < CENTS_TOLERANCE
        results.append(
            CheckResult(
                id=f"tax_consistency_{tr.code}",
                severity="info" if ok else ("error" if delta > 0.1 else "warn"),
                message=(
                    f"Tax code {tr.code}: ${tr.amount:.2f} ~= items (${code_base:.2f}) x {tr.rate * 100:.2f}% = ${expected_tax:.2f}"
                    if ok
                    else f"Tax code {tr.code}: ${tr.amount:.2f} != items (${code_base:.2f}) x {tr.rate * 100:.2f}% = ${expected_tax:.2f} — off by ${delta:.2f}"
                ),
                delta=delta,
                penalty=0 if ok else 3 + delta * 200,
            )
        )
    return results


def _check_tax_rate_plausibility(ctx: CheckContext) -> list[CheckResult]:
    if ctx.tax_rates:
        return [
            CheckResult(
                id=f"tax_rate_plausibility_{tr.code}",
                severity="info",
                message=f"Tax code {tr.code} rate {tr.rate * 100:.2f}% is plausible (0-15%)"
                if 0 <= tr.rate <= MAX_PLAUSIBLE_TAX_RATE
                else f"Tax code {tr.code} rate {tr.rate * 100:.2f}% is outside plausible range (0-15%)",
                penalty=0,
            )
            for tr in ctx.tax_rates
        ]
    if ctx.tax_rate is None:
        return []
    pct = ctx.tax_rate * 100
    ok = 0 <= ctx.tax_rate <= MAX_PLAUSIBLE_TAX_RATE
    return [
        CheckResult(
            id="tax_rate_plausibility",
            severity="info",
            message=f"Inferred tax rate {pct:.2f}% is plausible (0-15%)"
            if ok
            else f"Inferred tax rate {pct:.2f}% is outside plausible range (0-15%)",
            penalty=0,
        )
    ]


def _check_tender_vs_total(ctx: CheckContext) -> Optional[CheckResult]:
    if ctx.tender_amount is None or ctx.ocr_total is None:
        return None
    delta = abs(ctx.tender_amount - ctx.ocr_total)
    ok = delta < CENTS_TOLERANCE
    return CheckResult(
        id="tender_vs_total",
        severity="info",
        message=(
            f"Tender amount (${ctx.tender_amount:.2f}) matches TOTAL (${ctx.ocr_total:.2f})"
            if ok
            else f"Tender amount (${ctx.tender_amount:.2f}) != TOTAL (${ctx.ocr_total:.2f}) — off by ${delta:.2f}"
        ),
        delta=delta,
        penalty=0,
    )


def _check_missing_element(ctx: CheckContext) -> Optional[CheckResult]:
    reference = ctx.ocr_subtotal
    if reference is None and ctx.ocr_total is not None:
        reference = (
            ctx.ocr_total - ctx.ocr_tax if ctx.ocr_tax is not None else ctx.ocr_total
        )
    if reference is None:
        return None
    diff = reference - ctx.calculated_subtotal
    if abs(diff) < CENTS_TOLERANCE:
        return None
    abs_diff = abs(diff)
    if diff > 0:
        return CheckResult(
            id="missing_item_estimate",
            severity="warn",
            message=f"Subtotal mismatch suggests a missing item worth ~${abs_diff:.2f}",
            delta=abs_diff,
            penalty=6 + abs_diff * 20,
        )
    else:
        return CheckResult(
            id="missing_discount_estimate",
            severity="warn",
            message=f"Subtotal mismatch suggests a missing discount of ~${abs_diff:.2f} or an extra item was included",
            delta=abs_diff,
            penalty=6 + abs_diff * 20,
        )


def _check_missing_summary_lines(ctx: CheckContext) -> list[CheckResult]:
    results = []
    if ctx.ocr_subtotal is None:
        derivable = ctx.ocr_total is not None and ctx.ocr_tax is not None
        cross = ctx.ocr_total is not None
        results.append(
            CheckResult(
                id="missing_subtotal",
                severity="info" if (derivable or cross) else "warn",
                message="No SUBTOTAL line found on receipt — using TOTAL − TAX as reference"
                if derivable
                else (
                    "No SUBTOTAL line found on receipt — using TOTAL for cross-check"
                    if cross
                    else "No SUBTOTAL line found on receipt — cross-checks limited"
                ),
                penalty=0,
            )
        )
    if ctx.ocr_tax is None:
        irrelevant = (
            ctx.taxed_items_value <= 0
            or (
                ctx.ocr_total is not None
                and abs(ctx.calculated_subtotal - ctx.ocr_total) < CENTS_TOLERANCE
            )
            or (
                ctx.ocr_total is not None
                and ctx.calculated_subtotal > 0
                and ctx.calculated_subtotal < ctx.ocr_total
                and (ctx.ocr_total - ctx.calculated_subtotal) / ctx.calculated_subtotal
                <= 0.15
            )
        )
        results.append(
            CheckResult(
                id="missing_tax",
                severity="info",
                message="No TAX line found on receipt — no taxed items detected so tax is irrelevant"
                if irrelevant
                else "No TAX line found on receipt — tax rate cannot be verified",
                penalty=0 if irrelevant else 1,
            )
        )
    if ctx.ocr_total is None:
        results.append(
            CheckResult(
                id="missing_total",
                severity="warn",
                message="No TOTAL line found on receipt — cannot verify final amount",
                penalty=3,
            )
        )
    return results


# ── Overall score ────────────────────────────────────────────────────────────


def _compute_overall_score(checks: list[CheckResult], ctx: CheckContext) -> float:
    total_penalty = sum(c.penalty for c in checks)

    subtotal_coverable = ctx.ocr_subtotal is None and ctx.ocr_total is not None
    tax_irrelevant = ctx.ocr_tax is None and (
        ctx.taxed_items_value <= 0
        or (
            ctx.ocr_total is not None
            and abs(ctx.calculated_subtotal - ctx.ocr_total) < CENTS_TOLERANCE
        )
        or (
            ctx.ocr_total is not None
            and ctx.calculated_subtotal > 0
            and ctx.calculated_subtotal < ctx.ocr_total
            and (ctx.ocr_total - ctx.calculated_subtotal) / ctx.calculated_subtotal
            <= 0.15
        )
    )
    missing_count = (
        (1 if ctx.ocr_subtotal is None and not subtotal_coverable else 0)
        + (1 if ctx.ocr_tax is None and not tax_irrelevant else 0)
        + (1 if ctx.ocr_total is None else 0)
    )

    fit_quality = math.exp(-total_penalty / 50)
    missing_penalty = math.exp(-missing_count / 3)
    has_error = any(c.severity == "error" for c in checks)
    has_warn = any(c.severity == "warn" for c in checks)
    severity_cap = 0.6 if has_error else (0.85 if has_warn else 1.0)

    return min(fit_quality * missing_penalty, severity_cap)


# ── Main confidence pipeline ────────────────────────────────────────────────


def check_confidence(
    calculated_subtotal: float,
    taxed_items_value: float,
    untaxed_items_value: float,
    ocr_subtotal: Optional[float],
    ocr_tax: Optional[float],
    ocr_total: Optional[float],
    tax_rate: Optional[float],
    tender_amount: Optional[float] = None,
    tax_rates: list[TaxRateInfo] | None = None,
    items: list[ReceiptItem] | None = None,
) -> ReceiptConfidence:
    ctx = CheckContext(
        calculated_subtotal=calculated_subtotal,
        taxed_items_value=taxed_items_value,
        untaxed_items_value=untaxed_items_value,
        ocr_subtotal=ocr_subtotal,
        ocr_tax=ocr_tax,
        ocr_total=ocr_total,
        tax_rate=tax_rate,
        tax_rates=tax_rates,
        items=items,
        tender_amount=tender_amount,
    )

    all_checks: list[Optional[CheckResult]] = [
        _check_total_eq_subtotal_plus_tax(ctx),
        _check_taxability_balance(ctx),
        _check_calc_subtotal_vs_ocr(ctx),
        _check_calc_subtotal_vs_total_minus_tax(ctx),
        _check_tax_consistency(ctx),
    ]
    all_checks.extend(_check_per_code_tax_consistency(ctx))
    all_checks.extend(_check_tax_rate_plausibility(ctx))
    all_checks.append(_check_tender_vs_total(ctx))
    all_checks.append(_check_missing_element(ctx))
    all_checks.extend(_check_missing_summary_lines(ctx))

    checks = [c for c in all_checks if c is not None]

    def find_bool(id_str: str) -> Optional[bool]:
        c = next((ch for ch in checks if ch.id == id_str), None)
        return c.severity == "info" if c else None

    overall_score = _compute_overall_score(checks, ctx)

    return ReceiptConfidence(
        total_minus_tax_equals_ocr_subtotal=find_bool("total_eq_subtotal_plus_tax"),
        calculated_subtotal_equals_ocr_subtotal=find_bool(
            "calc_subtotal_vs_ocr_subtotal"
        ),
        calculated_subtotal_equals_total_minus_tax=find_bool(
            "calc_subtotal_vs_total_minus_tax"
        ),
        checks=checks,
        overall_score=overall_score,
        notes=[c.message for c in checks if c.severity == "info"],
        warnings=[
            f"[{c.severity.upper()}] {c.message}"
            for c in checks
            if c.severity in ("warn", "error")
        ],
    )
