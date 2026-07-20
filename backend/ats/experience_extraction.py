"""
Work-experience extraction.

The goal: find every "<start date> - <end date>" style range in a resume's
work-history section, convert each to a (start_year, start_month) /
(end_year, end_month) pair, then compute total experience by merging
overlapping ranges and summing the merged spans in months. This avoids
double-counting overlapping jobs and correctly handles "Present"/"Current"
as the end date.

This module is intentionally domain-agnostic: it never looks for IT
keywords. Any resume — sales, healthcare, education, finance, skilled
trades — has the same date-range structure in its work history, so this
approach generalizes to any role.
"""
import re
from datetime import date

MONTHS = {
    "jan": 1, "january": 1,
    "feb": 2, "february": 2,
    "mar": 3, "march": 3,
    "apr": 4, "april": 4,
    "may": 5,
    "jun": 6, "june": 6,
    "jul": 7, "july": 7,
    "aug": 8, "august": 8,
    "sep": 9, "sept": 9, "september": 9,
    "oct": 10, "october": 10,
    "nov": 11, "november": 11,
    "dec": 12, "december": 12,
}
MONTH_RE = "|".join(sorted(MONTHS.keys(), key=len, reverse=True))

CURRENT_WORDS = r"(?:present|current|now|till\s*date|ongoing)"

# Matches: "Jan 2020 - Mar 2022", "January 2020 to Present", "03/2019 - 06/2021",
# "2019 - 2022", "2020-Present"
DATE_RANGE_PATTERNS = [
    # Month Year - Month Year  (or Present)
    re.compile(
        rf"(?P<sm>{MONTH_RE})\.?\s+(?P<sy>\d{{4}})\s*(?:-|–|—|to)\s*"
        rf"(?:(?P<em>{MONTH_RE})\.?\s+(?P<ey>\d{{4}})|(?P<cur1>{CURRENT_WORDS}))",
        re.IGNORECASE,
    ),
    # MM/YYYY - MM/YYYY (or Present)
    re.compile(
        r"(?P<sm2>\d{1,2})[/\-](?P<sy2>\d{4})\s*(?:-|–|—|to)\s*"
        rf"(?:(?P<em2>\d{{1,2}})[/\-](?P<ey2>\d{{4}})|(?P<cur2>{CURRENT_WORDS}))",
        re.IGNORECASE,
    ),
    # YYYY - YYYY (or Present)  — least specific, checked last
    re.compile(
        rf"\b(?P<sy3>(?:19|20)\d{{2}})\s*(?:-|–|—|to)\s*"
        rf"(?:(?P<ey3>(?:19|20)\d{{2}})|(?P<cur3>{CURRENT_WORDS}))\b",
        re.IGNORECASE,
    ),
]

# Heuristic for picking up a "Job Title" line immediately preceding/following
# a date range, used only to label segments for transparency in the UI —
# scoring never depends on this being correct.
TITLE_LINE_RE = re.compile(r"^[A-Za-z][A-Za-z0-9&,./\-\s]{2,80}$")


def _today():
    t = date.today()
    return t.year, t.month


def _months_between(y1, m1, y2, m2):
    """Inclusive-ish month count between two (year, month) pairs."""
    return max(0, (y2 - y1) * 12 + (m2 - m1))


def find_date_ranges(resume_text):
    """
    Scan resume_text for date ranges and return a list of dicts:
    {start_year, start_month, end_year, end_month, is_current, raw_match, span_start_idx}
    """
    cur_y, cur_m = _today()
    found = []
    consumed_spans = []

    def overlaps_consumed(start, end):
        return any(not (end <= s or start >= e) for s, e in consumed_spans)

    for pattern in DATE_RANGE_PATTERNS:
        for m in pattern.finditer(resume_text):
            if overlaps_consumed(m.start(), m.end()):
                continue

            gd = m.groupdict()

            if "sm" in gd and gd.get("sm"):
                start_month = MONTHS[gd["sm"].lower()]
                start_year = int(gd["sy"])
                if gd.get("cur1"):
                    end_month, end_year, is_current = cur_m, cur_y, True
                else:
                    end_month = MONTHS[gd["em"].lower()]
                    end_year = int(gd["ey"])
                    is_current = False

            elif "sm2" in gd and gd.get("sm2"):
                start_month = max(1, min(12, int(gd["sm2"])))
                start_year = int(gd["sy2"])
                if gd.get("cur2"):
                    end_month, end_year, is_current = cur_m, cur_y, True
                else:
                    end_month = max(1, min(12, int(gd["em2"])))
                    end_year = int(gd["ey2"])
                    is_current = False

            else:
                # Year-only range — default to mid-year (June) for start
                # and end to avoid systematically over- or under-counting.
                start_year = int(gd["sy3"])
                start_month = 6
                if gd.get("cur3"):
                    end_month, end_year, is_current = cur_m, cur_y, True
                else:
                    end_year = int(gd["ey3"])
                    end_month = 6
                    is_current = False

            # Sanity: end must not precede start; skip nonsensical matches
            if (end_year, end_month) < (start_year, start_month):
                continue
            # Sanity: ignore implausible years (e.g. matched from a phone number)
            if start_year < 1960 or start_year > cur_y + 1:
                continue

            consumed_spans.append((m.start(), m.end()))
            found.append({
                "start_year": start_year,
                "start_month": start_month,
                "end_year": end_year,
                "end_month": end_month,
                "is_current": is_current,
                "raw_match": m.group(0),
                "span_start_idx": m.start(),
            })

    found.sort(key=lambda r: r["span_start_idx"])
    return found


def _guess_title_for_segment(resume_text, idx):
    """Look at the line(s) right before the date range for a plausible job title."""
    window_start = max(0, idx - 120)
    snippet = resume_text[window_start:idx]
    lines = [l.strip() for l in snippet.splitlines() if l.strip()]
    for line in reversed(lines[-3:]):
        if TITLE_LINE_RE.match(line) and len(line.split()) <= 8:
            return line
    return ""


def merge_and_sum_months(ranges):
    """
    Merge overlapping (start, end) month-index intervals and return the
    total number of months covered — this is the "compare min to max"
    requirement: rather than naively summing every job's duration (which
    would double-count overlapping/concurrent roles), we collapse the
    candidate's entire career timeline into non-overlapping spans first.
    """
    if not ranges:
        return 0

    intervals = []
    for r in ranges:
        start_idx = r["start_year"] * 12 + r["start_month"]
        end_idx = r["end_year"] * 12 + r["end_month"]
        if end_idx < start_idx:
            continue
        intervals.append((start_idx, end_idx))

    if not intervals:
        return 0

    intervals.sort()
    merged = [intervals[0]]
    for start, end in intervals[1:]:
        last_start, last_end = merged[-1]
        if start <= last_end + 1:
            merged[-1] = (last_start, max(last_end, end))
        else:
            merged.append((start, end))

    total = sum((end - start) for start, end in merged)
    return total


def extract_experience_segments(resume_text):
    """
    Returns (segments, total_months) where segments is a list of dicts with
    title/company guess + start/end labels + computed months, and
    total_months is the de-duplicated total span across the whole resume.
    """
    ranges = find_date_ranges(resume_text)

    segments = []
    for r in ranges:
        months = _months_between(r["start_year"], r["start_month"], r["end_year"], r["end_month"])
        title_guess = _guess_title_for_segment(resume_text, r["span_start_idx"])
        segments.append({
            "title_guess": title_guess,
            "start_year": r["start_year"],
            "start_month": r["start_month"],
            "end_year": r["end_year"],
            "end_month": r["end_month"],
            "is_current": r["is_current"],
            "months": months,
            "raw_match": r["raw_match"],
        })

    total_months = merge_and_sum_months(ranges)
    return segments, total_months


def months_to_label(months):
    if months is None:
        return "Not specified"
    years = months // 12
    rem_months = months % 12
    if years and rem_months:
        return f"{years} yr {rem_months} mo"
    if years:
        return f"{years} yr"
    return f"{rem_months} mo"
