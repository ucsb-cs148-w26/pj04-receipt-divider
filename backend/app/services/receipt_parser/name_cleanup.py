"""
Deterministic receipt item name normalization pipeline.

Takes raw OCR item names (e.g. "E 9211 ORG YEL ONIO") and converts
them to clean, human-readable sentence case (e.g. "Organic Yellow Onion").

Pipeline steps:
  1. Strip SKU / store-code prefixes
  2. Remove quantity syntax (e.g. "2 @ 0.49")
  3. Normalize punctuation
  4. Tokenize
  5. Correct OCR mistakes
  6. Expand abbreviations
  7. Detect and format quantity/unit suffixes
  8. Sentence-case formatting
"""

from __future__ import annotations

import re

from .abbreviations import ABBREVIATIONS, OCR_CORRECTIONS, STOPWORDS, UNIT_TOKENS

import unicodedata


# ── Language-based script filtering ──────────────────────────────────────
# Maps ISO 639-1 language codes to allowed Unicode script names.
# Characters whose script doesn't match any of these (and isn't Common or
# Inherited) are stripped from item names.

_LANG_SCRIPTS: dict[str, set[str]] = {
    "en": {"LATIN"},
    "es": {"LATIN"},
    "fr": {"LATIN"},
    "de": {"LATIN"},
    "it": {"LATIN"},
    "pt": {"LATIN"},
    "nl": {"LATIN"},
    "pl": {"LATIN"},
    "sv": {"LATIN"},
    "da": {"LATIN"},
    "no": {"LATIN"},
    "fi": {"LATIN"},
    "ja": {"CJK", "HIRAGANA", "KATAKANA", "LATIN"},
    "zh": {"CJK", "LATIN"},
    "ko": {"HANGUL", "CJK", "LATIN"},
    "ar": {"ARABIC"},
    "he": {"HEBREW", "LATIN"},
    "hi": {"DEVANAGARI", "LATIN"},
    "ru": {"CYRILLIC", "LATIN"},
    "uk": {"CYRILLIC", "LATIN"},
    "th": {"THAI", "LATIN"},
    "vi": {"LATIN"},
    "ta": {"TAMIL", "LATIN"},
}


def _get_script(char: str) -> str:
    """Get the Unicode script category for a character.

    Returns the script name (e.g., 'LATIN', 'TAMIL', 'CJK') or 'COMMON'
    for digits, punctuation, and symbols.
    """
    try:
        name = unicodedata.name(char, "")
    except ValueError:
        return "COMMON"

    if not name:
        return "COMMON"

    # Unicode character names start with the script name for most scripts
    name_upper = name.upper()
    for script in (
        "LATIN",
        "CYRILLIC",
        "ARABIC",
        "DEVANAGARI",
        "TAMIL",
        "THAI",
        "HANGUL",
        "HIRAGANA",
        "KATAKANA",
        "HEBREW",
        "GREEK",
        "ARMENIAN",
        "GEORGIAN",
        "BENGALI",
        "GUJARATI",
        "GURMUKHI",
        "KANNADA",
        "MALAYALAM",
        "ORIYA",
        "SINHALA",
        "TELUGU",
        "TIBETAN",
        "MYANMAR",
        "KHMER",
        "LAO",
        "ETHIOPIC",
    ):
        if name_upper.startswith(script):
            return script

    # CJK unified ideographs
    if "CJK" in name_upper or "IDEOGRAPH" in name_upper:
        return "CJK"

    return "COMMON"


def _filter_by_language(text: str, language: str) -> str:
    """Remove characters whose script doesn't match the detected language.

    Characters with COMMON script (digits, punctuation, spaces) are always kept.
    """
    allowed_scripts = _LANG_SCRIPTS.get(language)
    if allowed_scripts is None:
        # Unknown language — don't filter
        return text

    filtered: list[str] = []
    for char in text:
        script = _get_script(char)
        if script == "COMMON" or script in allowed_scripts:
            filtered.append(char)
        # else: drop the character (wrong script for this language)

    result = "".join(filtered)
    # Collapse any whitespace left by removed characters
    result = re.sub(r"\s{2,}", " ", result).strip()
    return result


# ── Step 1: Strip SKU / store-code prefixes ──────────────────────────────

# Costco-style "E 123456 ..." or plain numeric SKU "1801 ..."
_RE_SKU_PREFIX = re.compile(
    r"^(?:"
    r"[A-Z]\s+\d{4,}\s+"  # E 9211 ...
    r"|\d{4,}\s+"  # 1801 ...
    r"|[A-Z]-\s*"  # R- ...
    r")",
    re.IGNORECASE,
)


def _strip_sku(text: str) -> str:
    return _RE_SKU_PREFIX.sub("", text)


# ── Step 1b: Split multi-item groupings ──────────────────────────────────
# When OCR accidentally merges multiple items on one line, e.g.:
#   "Ug Membe 112007079368 E 931484 Ks Water Gal"
# We detect embedded SKU patterns and take only the last segment.

# Matches mid-line SKU patterns: long digit sequences (6+) or
# letter-prefixed SKUs like "E 931484"
_RE_EMBEDDED_SKU = re.compile(
    r"(?:^|\s)"
    r"(?:[A-Z]\s+)?\d{6,}"  # optional single-letter prefix + 6+ digits
    r"(?:\s|$)",
    re.IGNORECASE,
)


def _split_multi_item(text: str) -> str:
    """If the text contains embedded SKU patterns, take only the text
    after the last SKU occurrence."""
    matches = list(_RE_EMBEDDED_SKU.finditer(text))
    if not matches:
        return text
    # Take everything after the last embedded SKU
    last_match = matches[-1]
    remainder = text[last_match.end() :].strip()
    return remainder if remainder else text


# ── Step 2: Remove quantity syntax ───────────────────────────────────────

# "2 @ 0.49 BANANAS" or "3EA @ 0.29/EA PEANUT BUTTER"
_RE_QTY_PREFIX = re.compile(r"^\d+\s*(?:EA)?\s*@\s*[\d.]+(?:/EA)?\s*", re.IGNORECASE)


def _strip_quantity_prefix(text: str) -> str:
    return _RE_QTY_PREFIX.sub("", text)


# ── Step 3: Normalize punctuation ───────────────────────────────────────


def _normalize_punctuation(text: str) -> str:
    text = re.sub(r"\.{2,}", ".", text)  # collapse multiple periods
    text = re.sub(r"[.]+$", "", text)  # strip trailing periods
    text = text.replace("*", "")  # remove asterisks (tax markers)
    text = text.replace("$", "")  # remove dollar signs (OCR artifacts)
    text = re.sub(r"\s{2,}", " ", text)  # collapse whitespace
    return text.strip()


# ── Step 4 & 5: OCR correction (token-level) ────────────────────────────


def _correct_ocr(token: str) -> str:
    upper = token.upper()
    return OCR_CORRECTIONS.get(upper, token)


# ── Step 6: Abbreviation expansion (token-level) ────────────────────────


def _expand_abbreviation(token: str) -> str:
    upper = token.upper()
    return ABBREVIATIONS.get(upper, token)


# ── Step 7: Detect quantity/unit suffixes ────────────────────────────────
# Matches patterns like "10 OZ", "4CT", "1 LB", "2/31.7", "1 DOZ"

_RE_UNIT_SUFFIX = re.compile(
    r"(\d+(?:\.\d+)?)\s*(" + "|".join(re.escape(u) for u in UNIT_TOKENS) + r")\b",
    re.IGNORECASE,
)

_RE_FRACTION = re.compile(r"\d+/\d+(?:\.\d+)?")


def _extract_units(tokens: list[str]) -> tuple[list[str], str | None]:
    """Separate unit info from name tokens.

    Returns (remaining_tokens, unit_string_or_None).
    """
    rejoined = " ".join(tokens)

    units_found: list[str] = []

    def _replace_unit(m: re.Match) -> str:
        qty = m.group(1)
        raw_unit = m.group(2).upper()
        unit = UNIT_TOKENS.get(raw_unit, raw_unit.lower())
        units_found.append(f"{qty} {unit}")
        return ""

    cleaned = _RE_UNIT_SUFFIX.sub(_replace_unit, rejoined)

    # Also pull out fraction patterns like "2/31.7" (Costco pack sizes)
    fracs = _RE_FRACTION.findall(cleaned)
    for frac in fracs:
        units_found.append(frac)
        cleaned = cleaned.replace(frac, "", 1)

    cleaned = re.sub(r"\s{2,}", " ", cleaned).strip()
    remaining = cleaned.split() if cleaned else []
    unit_str = ", ".join(units_found) if units_found else None
    return remaining, unit_str


# ── Step 8: Sentence-case formatting ────────────────────────────────────


def _sentence_case(tokens: list[str]) -> str:
    """Convert tokens to sentence case (Title Case with stopwords lowered)."""
    result: list[str] = []
    for i, token in enumerate(tokens):
        lower = token.lower()
        if i == 0:
            # Always capitalize first word
            result.append(token.capitalize())
        elif lower in STOPWORDS:
            result.append(lower)
        else:
            result.append(token.capitalize())
    return " ".join(result)


# ── Public API ───────────────────────────────────────────────────────────


def clean_item_name(raw_name: str, language: str = "en") -> str:
    """Run the full name-cleanup pipeline on a single raw item name.

    Args:
        raw_name: The raw OCR item name.
        language: ISO 639-1 language code detected from the receipt.

    Returns a cleaned, sentence-cased string.
    """
    if not raw_name or not raw_name.strip():
        return raw_name

    text = raw_name.strip()

    # 0. Filter out characters that don't match the receipt's language script
    text = _filter_by_language(text, language)

    if not text:
        return raw_name.strip()

    # 1. Strip SKU prefixes
    text = _strip_sku(text)

    # 1b. Split multi-item groupings (take last item after embedded SKUs)
    text = _split_multi_item(text)

    # Re-strip SKU prefix on the remaining segment
    text = _strip_sku(text)

    # 2. Remove quantity syntax
    text = _strip_quantity_prefix(text)

    # 3. Normalize punctuation
    text = _normalize_punctuation(text)

    if not text:
        return raw_name.strip()

    # 4. Tokenize
    tokens = text.split()

    # 5. Correct OCR mistakes
    tokens = [_correct_ocr(t) for t in tokens]

    # 6. Expand abbreviations
    tokens = [_expand_abbreviation(t) for t in tokens]

    # 7. Extract unit suffixes
    tokens, unit_str = _extract_units(tokens)

    if not tokens:
        return raw_name.strip()

    # 8. Sentence case
    name = _sentence_case(tokens)

    # Append unit info in parentheses
    if unit_str:
        name = f"{name} ({unit_str})"

    return name
