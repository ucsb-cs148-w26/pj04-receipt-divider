"""
Post-processing edge-case handlers for receipt line reconstruction.
Python port of edge-cases.ts.
"""

from __future__ import annotations

import re
from typing import Optional

from .types import ReceiptLine
from .utils import classify_line, is_price, parse_price
from .constants import (
    WRAP_MAX_VERTICAL_GAP_FACTOR,
    WRAP_MAX_LEFT_ALIGN_FACTOR,
    ORPHAN_SEARCH_RADIUS,
)


# ── Shared helpers ───────────────────────────────────────────────────────────


def _is_trivial_item_name(name: Optional[str]) -> bool:
    if name is None:
        return True
    t = name.strip()
    if re.match(r"^\$?\d+(\.\d{1,2})?$", t):
        return True
    cleaned = re.sub(r"[^a-zA-Z0-9]", "", t)
    return len(cleaned) <= 1


# ── Voided entries ───────────────────────────────────────────────────────────

_VOID_FINE_PRINT = [
    re.compile(r"void where prohibited", re.I),
    re.compile(r"void if", re.I),
    re.compile(r"void after", re.I),
    re.compile(r"not valid.*void", re.I),
    re.compile(r"void outside", re.I),
]


def handle_voided_entries(lines: list[ReceiptLine]) -> None:
    for i in range(len(lines)):
        lower = lines[i].text.lower()
        if not re.search(r"\bvoid(ed)?\b", lower):
            continue
        if any(p.search(lines[i].text) for p in _VOID_FINE_PRINT):
            continue
        for j in range(i - 1, -1, -1):
            if lines[j].line_type in ("untaxed_item", "taxed_item"):
                lines[j].line_type = "info"
                break
        if lines[i].line_type != "info":
            lines[i].line_type = "info"


# ── Adjacent prices for keywords ────────────────────────────────────────────


def assign_adjacent_prices_to_keywords(lines: list[ReceiptLine]) -> None:
    def _is_price_only(ln: ReceiptLine) -> bool:
        if ln.line_type != "info":
            return False
        t = ln.text.strip().lstrip("$")
        return len(t) > 0 and is_price(t)

    for i in range(len(lines)):
        ln = lines[i]
        if ln.line_type not in ("subtotal", "total", "tax", "tender"):
            continue
        if ln.price is not None:
            continue

        if i - 1 >= 0 and _is_price_only(lines[i - 1]):
            ln.price = lines[i - 1].text.strip().lstrip("$")
            lines[i - 1].line_type = "wrapped"
            continue

        if i + 1 < len(lines) and _is_price_only(lines[i + 1]):
            ln.price = lines[i + 1].text.strip().lstrip("$")
            lines[i + 1].line_type = "wrapped"


# ── Reconstruct broken tax prices ───────────────────────────────────────────


def reconstruct_broken_tax_prices(lines: list[ReceiptLine]) -> None:
    for ln in lines:
        if ln.line_type != "tax" or ln.price is not None:
            continue
        words = ln.words
        if len(words) < 2:
            continue
        for i in range(len(words) - 1, 0, -1):
            curr = words[i].text.strip()
            prev = words[i - 1].text.strip()
            if re.match(r"^[:.]$", prev) and re.match(r"^\d{2}$", curr):
                ln.price = f"0.{curr}"
                break
            if re.match(r"^\$?\d+$", prev) and re.match(r"^\d{2}$", curr):
                base = prev.replace("$", "")
                ln.price = f"{base}.{curr}"
                break


# ── Split combined TAX / BAL lines ──────────────────────────────────────────


def split_tax_bal_line(lines: list[ReceiptLine]) -> None:
    i = 0
    while i < len(lines):
        ln = lines[i]
        if ln.line_type != "tax":
            i += 1
            continue
        m = re.search(
            r"\btax\s+(\d*\.?\d+)\s+bal(?:ance)?\s+(\d+\.\d{2})\b", ln.text, re.I
        )
        if not m:
            i += 1
            continue
        tax_val = m.group(1)
        bal_val = m.group(2)
        ln.price = tax_val
        synthetic = ReceiptLine(
            text=f"BAL {bal_val}",
            words=[],
            item_name=f"BAL {bal_val}",
            price=bal_val,
            line_type="total",
            angle=ln.angle,
        )
        lines.insert(i + 1, synthetic)
        i += 2


# ── Demote post-total items ─────────────────────────────────────────────────


def demote_post_total_items(lines: list[ReceiptLine]) -> None:
    boundary_idx = -1
    for i in range(len(lines) - 1, -1, -1):
        if (
            lines[i].line_type in ("total", "subtotal")
            and lines[i].price is not None
            and lines[i].line_type != "wrapped"
        ):
            boundary_idx = i
            break

    if boundary_idx == -1:
        return

    for i in range(boundary_idx + 1, len(lines)):
        ln = lines[i]
        if ln.line_type == "wrapped":
            continue
        if ln.line_type in ("untaxed_item", "taxed_item"):
            reclassified = classify_line(ln.text, ln.price)
            new_type = "tender" if reclassified == "tender" else "info"
            ln.line_type = new_type


# ── Fix keyword price assignment ────────────────────────────────────────────


def fix_keyword_price_assignment(lines: list[ReceiptLine]) -> None:
    # Phase 0: extract embedded prices
    for ln in lines:
        if ln.line_type == "wrapped":
            continue
        if ln.line_type not in ("subtotal", "tax", "total"):
            continue
        if ln.price is not None:
            continue
        matches = list(re.finditer(r"\$?(\d+\.\d{2})\b", ln.text))
        if not matches:
            continue
        last_match = matches[-1]
        extracted = last_match.group(1)
        val = float(extracted)
        if val > 0:
            ln.price = extracted

    sub = next(
        (ln for ln in lines if ln.line_type == "subtotal" and ln.price is not None),
        None,
    )
    tax = next(
        (ln for ln in lines if ln.line_type == "tax" and ln.price is not None), None
    )
    tot = next(
        (ln for ln in lines if ln.line_type == "total" and ln.price is not None), None
    )

    # Case 1: all three present
    if sub and tax and tot:
        pairs = [
            {"str": sub.price, "val": parse_price(sub.price)},
            {"str": tax.price, "val": parse_price(tax.price)},
            {"str": tot.price, "val": parse_price(tot.price)},
        ]
        sorted_pairs = sorted(pairs, key=lambda p: p["val"])
        if (
            sorted_pairs[0]["val"] >= 0
            and abs(
                sorted_pairs[0]["val"] + sorted_pairs[1]["val"] - sorted_pairs[2]["val"]
            )
            < 0.02
        ):
            ideal_tax = sorted_pairs[0]["str"]
            ideal_sub = sorted_pairs[1]["str"]
            ideal_tot = sorted_pairs[2]["str"]
            if (
                sub.price != ideal_sub
                or tax.price != ideal_tax
                or tot.price != ideal_tot
            ):
                sub.price = ideal_sub
                tax.price = ideal_tax
                tot.price = ideal_tot
        return

    # Case 2: only subtotal and tax
    if sub and tax:
        sub_val = parse_price(sub.price)
        tax_val = parse_price(tax.price)
        if sub_val > 0 and tax_val > 0 and sub_val < tax_val:
            sub.price, tax.price = tax.price, sub.price


# ── Competing totals ────────────────────────────────────────────────────────


def resolve_competing_totals(lines: list[ReceiptLine]) -> None:
    total_lines = [
        ln for ln in lines if ln.line_type == "total" and ln.price is not None
    ]
    if len(total_lines) <= 1:
        return

    sub = next(
        (ln for ln in lines if ln.line_type == "subtotal" and ln.price is not None),
        None,
    )
    tax = next(
        (ln for ln in lines if ln.line_type == "tax" and ln.price is not None), None
    )

    winner = None

    # Strategy 1: prefer total satisfying S + T = TOTAL
    if sub and tax:
        sub_val = parse_price(sub.price)
        tax_val = parse_price(tax.price)
        expected = sub_val + tax_val
        for t in total_lines:
            if abs(parse_price(t.price) - expected) < 0.015:
                winner = t
                break

    # Strategy 2: all totals same value → keep first
    if winner is None:
        vals = [parse_price(t.price) for t in total_lines]
        if all(abs(v - vals[0]) < 0.015 for v in vals):
            winner = total_lines[0]

    # Strategy 3: last total
    if winner is None:
        winner = total_lines[-1]

    for t in total_lines:
        if t is not winner:
            t.line_type = "info"


# ── Remove null item-name items ─────────────────────────────────────────────


def remove_null_item_name_items(lines: list[ReceiptLine]) -> None:
    for i in range(len(lines) - 1, -1, -1):
        if lines[i].item_name is None:
            lines.pop(i)


# ── Demote orphan post-subtotal prices ──────────────────────────────────────


def demote_orphan_post_subtotal_prices(lines: list[ReceiptLine]) -> None:
    first_keyword_idx = len(lines)
    for i in range(len(lines)):
        if lines[i].line_type == "wrapped":
            continue
        if lines[i].line_type in ("subtotal", "tax", "total"):
            first_keyword_idx = i
            break

    for i in range(first_keyword_idx, len(lines)):
        ln = lines[i]
        if ln.line_type == "wrapped":
            continue
        if ln.line_type not in ("untaxed_item", "taxed_item"):
            continue
        if not _is_trivial_item_name(ln.item_name):
            continue
        ln.line_type = "tender"


# ── Rescue barcode items ────────────────────────────────────────────────────


def rescue_barcode_items(lines: list[ReceiptLine]) -> None:
    has_items = any(ln.line_type in ("untaxed_item", "taxed_item") for ln in lines)
    if has_items:
        return

    subtotal_line = next(
        (ln for ln in lines if ln.line_type == "subtotal" and ln.price is not None),
        None,
    )
    if not subtotal_line:
        return

    subtotal_price = subtotal_line.price

    barcode_info = []
    for i, ln in enumerate(lines):
        if ln.line_type != "info":
            continue
        cleaned = re.sub(r"\d{3}-\d{3}-\d{4}", "", ln.text)
        cleaned = re.sub(r"\d{1,2}/\d{1,2}/\d{2,4}", "", cleaned)
        if re.search(r"\b\d{8,}\b", cleaned):
            barcode_info.append(i)

    if not barcode_info:
        return

    for idx in barcode_info:
        ln = lines[idx]
        ln.price = subtotal_price
        ln.line_type = "untaxed_item"


# ── Barcode-embedded prices ─────────────────────────────────────────────────


def extract_barcode_prices(lines: list[ReceiptLine]) -> None:
    for ln in lines:
        if ln.line_type != "info" or ln.price is not None:
            continue
        for i in range(len(ln.words)):
            m = re.match(r"^\d{6,}[_.](\d+\.\d{2})$", ln.words[i].text)
            if not m:
                continue
            price = m.group(1)
            suffix = ""
            remove_count = 1
            if i + 1 < len(ln.words) and re.match(
                r"^[A-Z]$", ln.words[i + 1].text.strip(), re.I
            ):
                suffix = " " + ln.words[i + 1].text.strip().upper()
                remove_count = 2

            ln.price = price + suffix
            del ln.words[i : i + remove_count]
            ln.text = " ".join(w.text for w in ln.words)
            ln.item_name = ln.text
            ln.line_type = classify_line(ln.text, ln.price)
            break


# ── Wrapped item names ──────────────────────────────────────────────────────


def handle_wrapped_names(lines: list[ReceiptLine], med_h: float) -> None:
    for i in range(len(lines) - 2, -1, -1):
        cur = lines[i]
        nxt = lines[i + 1]

        if cur.line_type != "info" or cur.price is not None:
            continue
        if nxt.price is None or nxt.line_type == "wrapped":
            continue

        cur_boxes = cur.words
        nxt_boxes = nxt.words
        if not cur_boxes or not nxt_boxes:
            continue

        cur_bottom = max(b.bottom for b in cur_boxes)
        nxt_top = min(b.top for b in nxt_boxes)
        gap = nxt_top - cur_bottom

        cur_left = min(b.left for b in cur_boxes)
        nxt_left = min(b.left for b in nxt_boxes)

        if (
            gap < WRAP_MAX_VERTICAL_GAP_FACTOR * med_h
            and abs(cur_left - nxt_left) < WRAP_MAX_LEFT_ALIGN_FACTOR * med_h
        ):
            merged_text = " ".join(filter(None, [cur.text, nxt.text]))
            merged_type = classify_line(merged_text, nxt.price)
            if merged_type in ("info", "tender"):
                continue

            nxt.item_name = " ".join(filter(None, [cur.text, nxt.item_name]))
            cur.line_type = "wrapped"


# ── Orphan item prices ──────────────────────────────────────────────────────


def merge_orphan_item_prices(lines: list[ReceiptLine], med_h: float) -> None:
    first_keyword_idx = len(lines)
    for i in range(len(lines)):
        if lines[i].line_type in ("subtotal", "tax", "total"):
            first_keyword_idx = i
            break

    keyword_mean_ys: list[float] = []
    for ln in lines:
        if ln.line_type in ("subtotal", "tax", "total") and ln.words:
            keyword_mean_ys.append(sum(w.center.y for w in ln.words) / len(ln.words))

    def is_reserved_for_keyword(cand: ReceiptLine) -> bool:
        if not cand.words:
            return False
        if cand.price is None or not re.match(r"^\d+(\.\d{1,2})?$", cand.price):
            return False
        cand_mean_y = sum(w.center.y for w in cand.words) / len(cand.words)
        return any(abs(cand_mean_y - ky) < 0.7 * med_h for ky in keyword_mean_ys)

    def is_orphan_price(ln: ReceiptLine) -> bool:
        return (
            ln.price is not None
            and _is_trivial_item_name(ln.item_name)
            and ln.line_type != "wrapped"
            and ln.line_type not in ("subtotal", "tax", "total")
            and len(ln.words) > 0
            and not is_reserved_for_keyword(ln)
        )

    def is_priceless_item(ln: ReceiptLine) -> bool:
        return ln.line_type == "info" and ln.price is None and len(ln.words) > 0

    def compute_residual(item: ReceiptLine, orphan: ReceiptLine) -> float:
        import math

        item_mean_x = sum(w.center.x for w in item.words) / len(item.words)
        item_mean_y = sum(w.center.y for w in item.words) / len(item.words)
        orphan_mean_x = sum(w.center.x for w in orphan.words) / len(orphan.words)
        orphan_mean_y = sum(w.center.y for w in orphan.words) / len(orphan.words)
        expected_y = item_mean_y + (orphan_mean_x - item_mean_x) * math.sin(item.angle)
        return abs(orphan_mean_y - expected_y)

    for i in range(first_keyword_idx):
        cur = lines[i]
        if not is_priceless_item(cur):
            continue

        best = None

        # Search UP
        for j in range(i - 1, max(-1, i - ORPHAN_SEARCH_RADIUS - 1), -1):
            if j >= first_keyword_idx:
                continue
            if not is_orphan_price(lines[j]):
                continue
            residual = compute_residual(cur, lines[j])
            if residual <= WRAP_MAX_VERTICAL_GAP_FACTOR * med_h:
                if best is None or residual < best["residual"]:
                    best = {"idx": j, "residual": residual}

        # Search DOWN if nothing above
        if best is None:
            for j in range(i + 1, min(len(lines), i + ORPHAN_SEARCH_RADIUS + 1)):
                if j >= first_keyword_idx:
                    continue
                if not is_orphan_price(lines[j]):
                    continue
                residual = compute_residual(cur, lines[j])
                if residual <= WRAP_MAX_VERTICAL_GAP_FACTOR * med_h:
                    best = {"idx": j, "residual": residual}
                    break

        if best is not None:
            orphan = lines[best["idx"]]
            merged_text = cur.text + " " + orphan.text
            merged_type = classify_line(merged_text, orphan.price)
            if merged_type in ("info", "tender"):
                continue

            cur.price = orphan.price
            cur.item_name = cur.text
            cur.text = cur.text + " " + orphan.text
            cur.words = cur.words + orphan.words
            cur.line_type = classify_line(cur.text, cur.price)
            orphan.line_type = "wrapped"


# ── Orphan keyword prices ───────────────────────────────────────────────────


def merge_orphan_prices(lines: list[ReceiptLine], med_h: float) -> None:
    def is_orphan_price(ln: ReceiptLine) -> bool:
        return (
            ln.price is not None
            and ln.line_type != "wrapped"
            and _is_trivial_item_name(ln.item_name)
            and len(ln.words) > 0
        )

    for i in range(len(lines)):
        cur = lines[i]
        if cur.line_type not in ("subtotal", "tax", "total") or cur.price is not None:
            continue
        if not cur.words:
            continue

        cur_top = min(w.top for w in cur.words)
        cur_bottom = max(w.bottom for w in cur.words)

        # Search UP
        best_above = None
        for j in range(i - 1, max(-1, i - ORPHAN_SEARCH_RADIUS - 1), -1):
            if not is_orphan_price(lines[j]):
                continue
            cand_bottom = max(w.bottom for w in lines[j].words)
            gap = cur_top - cand_bottom
            if gap <= WRAP_MAX_VERTICAL_GAP_FACTOR * med_h:
                if best_above is None or gap < best_above["gap"]:
                    best_above = {"idx": j, "gap": gap}

        # Search DOWN
        best_below = None
        if best_above is None:
            for j in range(i + 1, min(len(lines), i + ORPHAN_SEARCH_RADIUS + 1)):
                if not is_orphan_price(lines[j]):
                    continue
                cand_top = min(w.top for w in lines[j].words)
                gap = cand_top - cur_bottom
                if gap <= WRAP_MAX_VERTICAL_GAP_FACTOR * med_h:
                    best_below = {"idx": j, "gap": gap}
                    break

        if best_above is not None:
            prev = lines[best_above["idx"]]
            cur.price = prev.price
            cur.text = prev.text + " " + cur.text
            cur.words = prev.words + cur.words
            cur.line_type = classify_line(cur.text, cur.price)
            prev.line_type = "wrapped"
        elif best_below is not None:
            nxt = lines[best_below["idx"]]
            cur.price = nxt.price
            cur.text = cur.text + " " + nxt.text
            cur.words = cur.words + nxt.words
            cur.line_type = classify_line(cur.text, cur.price)
            nxt.line_type = "wrapped"
        else:
            # For total lines: check adjacent tender
            if cur.line_type == "total":
                for j in range(i + 1, min(len(lines), i + 3)):
                    adj = lines[j]
                    if adj.line_type == "wrapped":
                        continue
                    if (
                        adj.price is not None
                        and adj.line_type == "tender"
                        and adj.words
                    ):
                        adj_top = min(w.top for w in adj.words)
                        gap = adj_top - cur_bottom
                        if gap <= WRAP_MAX_VERTICAL_GAP_FACTOR * med_h:
                            cur.price = adj.price
                    break

    # Last-resort pass
    for i in range(len(lines)):
        cur = lines[i]
        if cur.line_type not in ("subtotal", "tax", "total") or cur.price is not None:
            continue
        if not cur.words:
            continue

        cur_y = sum(w.center.y for w in cur.words) / len(cur.words)
        best_idx = -1
        best_dist = float("inf")

        for j in range(len(lines)):
            if not is_orphan_price(lines[j]):
                continue
            cand_y = sum(w.center.y for w in lines[j].words) / len(lines[j].words)
            dist = abs(cand_y - cur_y)
            if dist < best_dist:
                best_dist = dist
                best_idx = j

        if best_idx >= 0 and best_dist <= 5 * med_h:
            orphan = lines[best_idx]
            cur.price = orphan.price
            cur.text = cur.text + " " + orphan.text
            cur.words = cur.words + orphan.words
            cur.line_type = classify_line(cur.text, cur.price)
            orphan.line_type = "wrapped"
