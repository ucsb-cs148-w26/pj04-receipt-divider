"""
Hybrid receipt-line reconstruction algorithm (Method 3: line-first).
Python port of algorithm.ts.
"""

from __future__ import annotations

import math
import random
import re
from dataclasses import dataclass
from typing import Optional

from .types import WordBox, Point, ReceiptLine, ReconstructionResult
from .utils import (
    annotation_to_word_box,
    median,
    rotate_point,
    angle_between,
    is_price,
    try_strip_tax_flag,
    classify_line,
)
from .constants import (
    ANGLE_PAIR_MAX_DY_FACTOR,
    ANGLE_PAIR_MIN_DX_FACTOR,
    ANGLE_PAIR_MAX_DX_FACTOR,
    ANGLE_MAX_ABS_RAD,
    ANGLE_HISTOGRAM_BIN_DEG,
    LINE_CLUSTER_Y_THRESHOLD_FACTOR,
    RANSAC_SPLIT_THRESHOLD_FACTOR,
    RANSAC_MIN_CLUSTER_SIZE,
    RANSAC_INLIER_DIST_FACTOR,
    RANSAC_MAX_ITERATIONS,
    RANSAC_MIN_INLIERS,
    FRAGMENT_MERGE_GAP_FACTOR,
    PRICE_COLUMN_MIN_PRICES,
    PRICE_COLUMN_TOLERANCE_FACTOR,
    NEIGHBOR_Y_OVERLAP_MIN,
    NEIGHBOR_MAX_X_GAP_FACTOR,
    NEIGHBOR_MAX_HEIGHT_RATIO,
    NEIGHBOR_SHORT_GAP_FACTOR,
    VECTOR_Y_TOLERANCE_FACTOR,
)
from .edge_cases import (
    handle_voided_entries,
    assign_adjacent_prices_to_keywords,
    split_tax_bal_line,
    demote_post_total_items,
    fix_keyword_price_assignment,
    resolve_competing_totals,
    remove_null_item_name_items,
    handle_wrapped_names,
    merge_orphan_item_prices,
    merge_orphan_prices,
    reconstruct_broken_tax_prices,
    extract_barcode_prices,
    rescue_barcode_items,
    demote_orphan_post_subtotal_prices,
)


@dataclass
class RotatedBox:
    """WordBox extended with rotated coordinates."""

    # Original WordBox fields
    text: str
    center: Point
    left: float
    right: float
    top: float
    bottom: float
    width: float
    height: float
    vertices: list[Point]
    original: dict
    # Rotated fields
    rc: Point
    r_left: float
    r_right: float
    r_top: float
    r_bottom: float

    @staticmethod
    def from_word_box(
        wb: WordBox,
        rc: Point,
        r_left: float,
        r_right: float,
        r_top: float,
        r_bottom: float,
    ) -> "RotatedBox":
        return RotatedBox(
            text=wb.text,
            center=wb.center,
            left=wb.left,
            right=wb.right,
            top=wb.top,
            bottom=wb.bottom,
            width=wb.width,
            height=wb.height,
            vertices=wb.vertices,
            original=wb.original,
            rc=rc,
            r_left=r_left,
            r_right=r_right,
            r_top=r_top,
            r_bottom=r_bottom,
        )


# ── Union-Find ───────────────────────────────────────────────────────────────


class UnionFind:
    def __init__(self, n: int):
        self.parent = list(range(n))
        self.rank = [0] * n

    def find(self, x: int) -> int:
        if self.parent[x] != x:
            self.parent[x] = self.find(self.parent[x])
        return self.parent[x]

    def union(self, a: int, b: int) -> None:
        ra, rb = self.find(a), self.find(b)
        if ra == rb:
            return
        if self.rank[ra] < self.rank[rb]:
            self.parent[ra] = rb
        elif self.rank[ra] > self.rank[rb]:
            self.parent[rb] = ra
        else:
            self.parent[rb] = ra
            self.rank[ra] += 1


# ── Stage 1a ─────────────────────────────────────────────────────────────────


def _build_tentative_lines(boxes: list[WordBox], med_h: float) -> list[list[WordBox]]:
    n = len(boxes)
    if n == 0:
        return []

    uf = UnionFind(n)

    # Phase 1: short-range neighbor connections
    short_gap = NEIGHBOR_SHORT_GAP_FACTOR * med_h

    for i in range(n):
        a = boxes[i]
        best_j = -1
        best_x_dist = float("inf")

        for j in range(n):
            if i == j:
                continue
            b = boxes[j]
            if b.center.x <= a.center.x:
                continue

            overlap_top = max(a.top, b.top)
            overlap_bottom = min(a.bottom, b.bottom)
            overlap = max(0, overlap_bottom - overlap_top)
            min_h = min(a.height, b.height)
            if min_h <= 0 or overlap / min_h < NEIGHBOR_Y_OVERLAP_MIN:
                continue

            max_h = max(a.height, b.height)
            if max_h / min_h > NEIGHBOR_MAX_HEIGHT_RATIO:
                continue

            x_gap = max(0, b.left - a.right)
            if x_gap > short_gap:
                continue

            x_dist = b.center.x - a.center.x
            if x_dist < best_x_dist:
                best_x_dist = x_dist
                best_j = j

        if best_j >= 0:
            uf.union(i, best_j)

    # Phase 2: vector-extended connections
    long_gap = NEIGHBOR_MAX_X_GAP_FACTOR * med_h
    vector_tol = VECTOR_Y_TOLERANCE_FACTOR * med_h

    p1_root = [uf.find(i) for i in range(n)]
    p1_groups: dict[int, list[int]] = {}
    for i in range(n):
        r = p1_root[i]
        p1_groups.setdefault(r, []).append(i)

    candidates: list[dict] = []

    for line_root, line_indices in p1_groups.items():
        if len(line_indices) < 2:
            # Singleton fallback
            s_idx = line_indices[0]
            s = boxes[s_idx]
            for i in range(n):
                if p1_root[i] == line_root:
                    continue
                b = boxes[i]
                if b.center.x <= s.center.x:
                    continue
                x_gap = max(0, b.left - s.right)
                if x_gap <= short_gap or x_gap > long_gap:
                    continue
                s_min_h = min(s.height, b.height)
                s_max_h = max(s.height, b.height)
                if s_max_h / s_min_h > NEIGHBOR_MAX_HEIGHT_RATIO:
                    continue
                overlap_top = max(s.top, b.top)
                overlap_bottom = min(s.bottom, b.bottom)
                overlap = max(0, overlap_bottom - overlap_top)
                min_h = min(s.height, b.height)
                if min_h <= 0 or overlap / min_h < NEIGHBOR_Y_OVERLAP_MIN:
                    continue
                y_error = abs(b.center.y - s.center.y)
                candidates.append({
                    "y_error": y_error,
                    "line_rightmost_idx": s_idx,
                    "target_p1_root": p1_root[i],
                    "target_idx": i,
                })
            continue

        line_boxes = [boxes[idx] for idx in line_indices]
        angle = _compute_line_angle(line_boxes)

        # Find rightmost box in this line
        r_idx = line_indices[0]
        for idx in line_indices:
            if boxes[idx].right > boxes[r_idx].right:
                r_idx = idx
        r_box = boxes[r_idx]

        for i in range(n):
            if p1_root[i] == line_root:
                continue
            b = boxes[i]
            if b.center.x <= r_box.center.x:
                continue
            x_gap = max(0, b.left - r_box.right)
            if x_gap > long_gap:
                continue
            b_min_h = min(b.height, r_box.height)
            b_max_h = max(b.height, r_box.height)
            if b_max_h / b_min_h > NEIGHBOR_MAX_HEIGHT_RATIO:
                continue
            dx = b.center.x - r_box.center.x
            expected_y = r_box.center.y + dx * math.tan(angle)
            y_error = abs(b.center.y - expected_y)
            candidates.append({
                "y_error": y_error,
                "line_rightmost_idx": r_idx,
                "target_p1_root": p1_root[i],
                "target_idx": i,
            })

    candidates.sort(key=lambda c: c["y_error"])
    claimed: set[int] = set()
    for c in candidates:
        if c["y_error"] > vector_tol:
            break
        if c["target_p1_root"] in claimed:
            continue
        if uf.find(c["target_idx"]) == uf.find(c["line_rightmost_idx"]):
            continue
        claimed.add(c["target_p1_root"])
        uf.union(c["line_rightmost_idx"], c["target_idx"])

    # Extract final groups
    groups: dict[int, list[int]] = {}
    for i in range(n):
        root = uf.find(i)
        groups.setdefault(root, []).append(i)

    result = []
    for indices in groups.values():
        line = [boxes[idx] for idx in indices]
        line.sort(key=lambda b: b.center.x)
        result.append(line)
    return result


# ── Stage 1b ─────────────────────────────────────────────────────────────────


def _compute_line_angle(line: list[WordBox]) -> float:
    if len(line) < 2:
        return 0.0
    n = len(line)
    mean_x = sum(b.center.x for b in line) / n
    mean_y = sum(b.center.y for b in line) / n
    num = 0.0
    den = 0.0
    for box in line:
        dx = box.center.x - mean_x
        dy = box.center.y - mean_y
        num += dx * dy
        den += dx * dx
    if abs(den) < 1e-9:
        return 0.0
    return math.atan2(num, den)


# ── Stage 1c ─────────────────────────────────────────────────────────────────


def _estimate_global_angle(boxes: list[WordBox]) -> float:
    if len(boxes) < 2:
        return 0.0
    med_h = median([b.height for b in boxes])
    if med_h <= 0:
        return 0.0

    angles: list[float] = []
    for i in range(len(boxes)):
        for j in range(i + 1, len(boxes)):
            a = boxes[i].center
            b = boxes[j].center
            dy = abs(a.y - b.y)
            dx = abs(a.x - b.x)
            if dy > ANGLE_PAIR_MAX_DY_FACTOR * med_h:
                continue
            if dx < ANGLE_PAIR_MIN_DX_FACTOR * med_h:
                continue
            if dx > ANGLE_PAIR_MAX_DX_FACTOR * med_h:
                continue
            ang = angle_between(a, b)
            if ang > math.pi / 2:
                ang -= math.pi
            if ang < -math.pi / 2:
                ang += math.pi
            if abs(ang) < ANGLE_MAX_ABS_RAD:
                angles.append(ang)

    if not angles:
        return 0.0

    bin_size = ANGLE_HISTOGRAM_BIN_DEG * math.pi / 180
    bins: dict[int, int] = {}
    for a in angles:
        key = round(a / bin_size)
        bins[key] = bins.get(key, 0) + 1

    best_bin = 0
    best_count = 0
    for b, count in bins.items():
        if count > best_count:
            best_count = count
            best_bin = b
    return best_bin * bin_size


# ── Stage 2a ─────────────────────────────────────────────────────────────────


def _rotate_boxes(boxes: list[WordBox], angle: float) -> list[RotatedBox]:
    result = []
    for box in boxes:
        rc = rotate_point(box.center, -angle)
        rv = [rotate_point(v, -angle) for v in box.vertices]
        rxs = [v.x for v in rv]
        rys = [v.y for v in rv]
        result.append(
            RotatedBox.from_word_box(
                box,
                rc,
                r_left=min(rxs),
                r_right=max(rxs),
                r_top=min(rys),
                r_bottom=max(rys),
            )
        )
    return result


# ── Stage 2b ─────────────────────────────────────────────────────────────────


def _cluster_into_lines(
    boxes: list[RotatedBox], med_h: float
) -> list[list[RotatedBox]]:
    if not boxes:
        return []

    sorted_boxes = sorted(boxes, key=lambda b: b.rc.y)
    threshold = LINE_CLUSTER_Y_THRESHOLD_FACTOR * med_h

    clusters: list[dict] = []  # {'items': [...], 'mean_y': float}

    for box in sorted_boxes:
        best = None
        best_dist = float("inf")
        for c in clusters:
            d = abs(box.rc.y - c["mean_y"])
            if d < threshold and d < best_dist:
                best_dist = d
                best = c

        if best:
            best["items"].append(box)
            best["mean_y"] = sum(b.rc.y for b in best["items"]) / len(best["items"])
        else:
            clusters.append({"items": [box], "mean_y": box.rc.y})

    clusters.sort(key=lambda c: c["mean_y"])
    return [c["items"] for c in clusters]


# ── Stage 2c ─────────────────────────────────────────────────────────────────


def _ransac_split_cluster(
    cluster: list[RotatedBox], med_h: float
) -> list[list[RotatedBox]]:
    ys = [b.rc.y for b in cluster]
    y_range = max(ys) - min(ys)

    if (
        y_range < RANSAC_SPLIT_THRESHOLD_FACTOR * med_h
        or len(cluster) < RANSAC_MIN_CLUSTER_SIZE
    ):
        return [cluster]

    inlier_dist = RANSAC_INLIER_DIST_FACTOR * med_h
    lines: list[list[RotatedBox]] = []
    remaining = list(cluster)

    while len(remaining) >= 2:
        best_inliers: list[RotatedBox] = []

        for _ in range(RANSAC_MAX_ITERATIONS):
            i1 = random.randrange(len(remaining))
            i2 = random.randrange(len(remaining) - 1)
            if i2 >= i1:
                i2 += 1

            p1 = remaining[i1].rc
            p2 = remaining[i2].rc
            a = p2.y - p1.y
            b = p1.x - p2.x
            c = p2.x * p1.y - p1.x * p2.y
            norm = math.hypot(a, b)
            if norm < 1e-9:
                continue

            inliers = [
                box
                for box in remaining
                if abs(a * box.rc.x + b * box.rc.y + c) / norm < inlier_dist
            ]

            if len(inliers) > len(best_inliers):
                best_inliers = inliers

        if len(best_inliers) < RANSAC_MIN_INLIERS:
            if lines:
                _attach_to_nearest_line(remaining, lines)
            else:
                lines.append(remaining)
            remaining = []
            break

        lines.append(best_inliers)
        inlier_set = set(id(b) for b in best_inliers)
        remaining = [b for b in remaining if id(b) not in inlier_set]

    if remaining:
        if lines:
            _attach_to_nearest_line(remaining, lines)
        else:
            lines.append(remaining)

    lines.sort(key=lambda ln: _mean_y(ln))
    return lines


def _attach_to_nearest_line(
    boxes: list[RotatedBox], lines: list[list[RotatedBox]]
) -> None:
    for box in boxes:
        nearest = lines[0]
        nearest_dist = float("inf")
        for line in lines:
            d = abs(box.rc.y - _mean_y(line))
            if d < nearest_dist:
                nearest_dist = d
                nearest = line
        nearest.append(box)


def _mean_y(line: list[RotatedBox]) -> float:
    return sum(b.rc.y for b in line) / len(line)


# ── Stage 3 ──────────────────────────────────────────────────────────────────


def _order_words_in_line(line: list[RotatedBox]) -> list[RotatedBox]:
    return sorted(line, key=lambda b: b.r_left)


def _build_line_text(ordered: list[RotatedBox], char_w: float) -> str:
    if not ordered:
        return ""
    text = ordered[0].text
    for i in range(1, len(ordered)):
        gap = ordered[i].r_left - ordered[i - 1].r_right
        text += "" if gap < char_w * FRAGMENT_MERGE_GAP_FACTOR else " "
        text += ordered[i].text
    return text


# ── Stage 4 ──────────────────────────────────────────────────────────────────


def _detect_price_column_x(all_lines: list[list[RotatedBox]]) -> Optional[float]:
    price_rights: list[float] = []
    for line in all_lines:
        for box in line:
            if is_price(box.text) or try_strip_tax_flag(box.text):
                price_rights.append(box.right)
    if len(price_rights) >= PRICE_COLUMN_MIN_PRICES:
        return median(price_rights)
    return None


def _assign_price(
    ordered: list[RotatedBox], price_col_x: Optional[float], med_h: float
) -> tuple[Optional[str], int]:
    for i in range(len(ordered) - 1, -1, -1):
        raw_text = ordered[i].text
        stripped = try_strip_tax_flag(raw_text)
        if not is_price(raw_text) and not stripped:
            continue

        if price_col_x is not None:
            check_right = ordered[i].right
            extra_tol = 0
            if i > 0 and ordered[i - 1].text.strip() == "$":
                line_text = " ".join(w.text for w in ordered).lower()
                if re.search(
                    r"\b(total|subtotal|sub.?total|balance|amount\s+due|tax|hst|gst|pst|net\s+sales)\b",
                    line_text,
                ):
                    check_right = ordered[i - 1].right
                    extra_tol = med_h
            if (
                abs(check_right - price_col_x)
                > PRICE_COLUMN_TOLERANCE_FACTOR * med_h + extra_tol
            ):
                continue

        price = (stripped or raw_text).strip()

        # Absorb trailing suffix tokens
        for j in range(i + 1, min(i + 3, len(ordered))):
            suf = ordered[j].text.strip()
            if not re.match(r"^(-|[A-Z]|-[A-Z])$", suf, re.I):
                break
            upper = suf.upper()
            candidates_list = [price + upper, price + " " + upper, price + "-" + upper]
            match = next((c for c in candidates_list if is_price(c)), None)
            if match:
                price = match
            else:
                break

        return price, i

    return None, -1


# ── Public entry point ───────────────────────────────────────────────────────


def reconstruct_lines(annotations: list[dict]) -> ReconstructionResult:
    """
    Reconstruct ordered receipt lines from an unordered list of word-level
    OCR annotations. Pass annotations[1:] (skip the full-text block).
    """
    boxes = [annotation_to_word_box(ann) for ann in annotations]
    if not boxes:
        return ReconstructionResult(lines=[], angle=0.0)

    med_h = median([b.height for b in boxes])
    char_w = median([
        b.width / len(b.text) for b in boxes if len(b.text) > 0 and b.width > 0
    ])

    # Stage 1a
    tentative_lines = _build_tentative_lines(boxes, med_h)

    # Stage 1b
    line_angles = [_compute_line_angle(line) for line in tentative_lines]

    # Stage 1c
    valid_angles = [a for a in line_angles if a != 0]
    global_angle = (
        median(valid_angles) if valid_angles else _estimate_global_angle(boxes)
    )
    resolved_angles = [a if a != 0 else global_angle for a in line_angles]

    # Stage 2
    final_buckets: list[dict] = []  # {'boxes': list[RotatedBox], 'angle': float}
    for i, tentative_line in enumerate(tentative_lines):
        angle = resolved_angles[i]
        rotated = _rotate_boxes(tentative_line, angle)
        y_clusters = _cluster_into_lines(rotated, med_h)
        for cluster in y_clusters:
            splits = _ransac_split_cluster(cluster, med_h)
            for split in splits:
                final_buckets.append({"boxes": split, "angle": angle})

    # Stage 3
    ordered_buckets = [
        {"ordered": _order_words_in_line(bucket["boxes"]), "angle": bucket["angle"]}
        for bucket in final_buckets
    ]

    # Stage 3b: detect price column & split multi-price lines
    price_col_x = _detect_price_column_x([b["ordered"] for b in ordered_buckets])

    if price_col_x is not None:
        for bi in range(len(ordered_buckets) - 1, -1, -1):
            ordered = ordered_buckets[bi]["ordered"]
            angle = ordered_buckets[bi]["angle"]
            price_indices: list[int] = []
            for wi in range(len(ordered)):
                if (
                    is_price(ordered[wi].text) or try_strip_tax_flag(ordered[wi].text)
                ) and abs(
                    ordered[wi].right - price_col_x
                ) <= PRICE_COLUMN_TOLERANCE_FACTOR * med_h:
                    price_indices.append(wi)
            if len(price_indices) < 2:
                continue

            sub_lines = []
            start = 0
            for pi in price_indices:
                sub_lines.append({"ordered": ordered[start : pi + 1], "angle": angle})
                start = pi + 1
            if start < len(ordered):
                sub_lines[-1]["ordered"] = sub_lines[-1]["ordered"] + ordered[start:]

            ordered_buckets[bi : bi + 1] = sub_lines

    # Stage 4: price assignment
    receipt_lines: list[ReceiptLine] = []
    for bucket in ordered_buckets:
        ordered = bucket["ordered"]
        angle = bucket["angle"]
        text = _build_line_text(ordered, char_w)
        price, price_index = _assign_price(ordered, price_col_x, med_h)

        item_name = (
            _build_line_text(ordered[:price_index], char_w).strip()
            if price_index >= 0
            else text.strip()
        )

        line_type = classify_line(text, price)

        # Convert RotatedBox words back to WordBox for ReceiptLine
        word_boxes = [
            WordBox(
                text=rb.text,
                center=rb.center,
                left=rb.left,
                right=rb.right,
                top=rb.top,
                bottom=rb.bottom,
                width=rb.width,
                height=rb.height,
                vertices=rb.vertices,
                original=rb.original,
            )
            for rb in ordered
        ]

        receipt_lines.append(
            ReceiptLine(
                words=word_boxes,
                text=text,
                item_name=item_name or None,
                price=price,
                line_type=line_type,
                angle=angle,
            )
        )

    # Stage 5: sort top -> bottom, edge cases
    receipt_lines.sort(
        key=lambda ln: (
            sum(w.center.y for w in ln.words) / len(ln.words) if ln.words else 0
        )
    )

    merge_orphan_item_prices(receipt_lines, med_h)
    extract_barcode_prices(receipt_lines)
    split_tax_bal_line(receipt_lines)
    assign_adjacent_prices_to_keywords(receipt_lines)
    reconstruct_broken_tax_prices(receipt_lines)
    merge_orphan_prices(receipt_lines, med_h)
    demote_orphan_post_subtotal_prices(receipt_lines)
    handle_wrapped_names(receipt_lines, med_h)
    demote_post_total_items(receipt_lines)
    handle_voided_entries(receipt_lines)
    resolve_competing_totals(receipt_lines)
    fix_keyword_price_assignment(receipt_lines)
    rescue_barcode_items(receipt_lines)
    remove_null_item_name_items(receipt_lines)

    return ReconstructionResult(lines=receipt_lines, angle=global_angle)
