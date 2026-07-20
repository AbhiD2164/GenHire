"""
Location extraction for resumes.

Works for ANY role/industry because it doesn't depend on skill keywords —
it looks for geographic signals: known country names, a curated list of
major world cities, and common "City, State/Country" formatting patterns
that typically appear near the top of a resume (contact info block).
"""
import re
import pycountry

# A reasonably broad set of major cities across continents so the matcher
# isn't biased toward any one country. Extend this list as needed.
MAJOR_CITIES = [
    # India
    "mumbai", "delhi", "new delhi", "bengaluru", "bangalore", "hyderabad",
    "chennai", "kolkata", "pune", "ahmedabad", "jaipur", "surat", "lucknow",
    "nagpur", "indore", "chandigarh", "bhopal", "noida", "gurugram", "gurgaon",
    "kochi", "coimbatore", "visakhapatnam", "nashik", "vadodara", "patna",
    # USA
    "new york", "los angeles", "chicago", "houston", "phoenix", "philadelphia",
    "san antonio", "san diego", "dallas", "san jose", "austin", "san francisco",
    "seattle", "boston", "denver", "atlanta", "miami", "washington",
    # UK / Europe
    "london", "manchester", "birmingham", "leeds", "glasgow", "edinburgh",
    "dublin", "paris", "berlin", "munich", "frankfurt", "hamburg",
    "amsterdam", "rotterdam", "madrid", "barcelona", "rome", "milan",
    "lisbon", "zurich", "geneva", "vienna", "warsaw", "prague", "brussels",
    "stockholm", "copenhagen", "oslo", "helsinki",
    # Middle East
    "dubai", "abu dhabi", "doha", "riyadh", "jeddah", "manama", "muscat",
    # APAC
    "singapore", "hong kong", "shanghai", "beijing", "shenzhen", "tokyo",
    "osaka", "seoul", "sydney", "melbourne", "brisbane", "perth", "auckland",
    "kuala lumpur", "jakarta", "manila", "bangkok", "ho chi minh city", "hanoi",
    # Canada / LATAM / Africa
    "toronto", "vancouver", "montreal", "ottawa", "calgary",
    "mexico city", "sao paulo", "rio de janeiro", "buenos aires", "santiago",
    "cape town", "johannesburg", "nairobi", "lagos", "cairo",
]

COUNTRY_NAMES = sorted(
    {c.name.lower() for c in pycountry.countries} |
    {"usa", "uk", "u.s.a", "u.s.", "united states", "uae"},
    key=len,
    reverse=True,
)

INDIAN_STATES = [
    "andhra pradesh", "arunachal pradesh", "assam", "bihar", "chhattisgarh",
    "goa", "gujarat", "haryana", "himachal pradesh", "jharkhand", "karnataka",
    "kerala", "madhya pradesh", "maharashtra", "manipur", "meghalaya",
    "mizoram", "nagaland", "odisha", "punjab", "rajasthan", "sikkim",
    "tamil nadu", "telangana", "tripura", "uttar pradesh", "uttarakhand",
    "west bengal", "delhi",
]

US_STATE_ABBR = {
    "al", "ak", "az", "ar", "ca", "co", "ct", "de", "fl", "ga", "hi", "id",
    "il", "in", "ia", "ks", "ky", "la", "me", "md", "ma", "mi", "mn", "ms",
    "mo", "mt", "ne", "nv", "nh", "nj", "nm", "ny", "nc", "nd", "oh", "ok",
    "or", "pa", "ri", "sc", "sd", "tn", "tx", "ut", "vt", "va", "wa", "wv",
    "wi", "wy",
}

# "City, ST" / "City, ST 12345" / "City, Country" pattern, case-insensitive,
# checked against the original-cased text (not lowercased) to keep proper
# noun capitalization as a signal.
CITY_STATE_PATTERN = re.compile(
    r"\b([A-Z][a-zA-Z.\-]+(?:\s[A-Z][a-zA-Z.\-]+){0,2}),\s*([A-Z]{2})\b(?:\s*\d{5})?"
)
CITY_COUNTRY_PATTERN = re.compile(
    r"\b([A-Z][a-zA-Z.\-]+(?:\s[A-Z][a-zA-Z.\-]+){0,2}),\s*([A-Z][a-zA-Z]+(?:\s[A-Z][a-zA-Z]+)*)\b"
)


def extract_location(resume_text):
    """
    Best-effort location extraction. Strategy, in priority order:
      1. Look in the first ~600 characters (header/contact block) for a
         "City, ST" or "City, Country" pattern.
      2. Scan the full text for any known major city name.
      3. Scan the full text for any known country name.
      4. Scan for an Indian state name (common when city isn't listed).
    Returns a human-readable string or "" if nothing found.
    """
    header = resume_text[:600]

    match = CITY_STATE_PATTERN.search(header)
    if match:
        city, state = match.group(1).strip(), match.group(2).strip()
        if state.lower() in US_STATE_ABBR:
            return f"{city}, {state}"

    match = CITY_COUNTRY_PATTERN.search(header)
    if match:
        city, country = match.group(1).strip(), match.group(2).strip()
        if country.lower() in COUNTRY_NAMES:
            return f"{city}, {country}"

    lower_text = resume_text.lower()

    for city in MAJOR_CITIES:
        if re.search(r"\b" + re.escape(city) + r"\b", lower_text):
            return city.title()

    for country in COUNTRY_NAMES:
        if len(country) < 4:
            continue  # skip ultra-short names prone to false positives
        if re.search(r"\b" + re.escape(country) + r"\b", lower_text):
            return country.title()

    for state in INDIAN_STATES:
        if re.search(r"\b" + re.escape(state) + r"\b", lower_text):
            return state.title()

    return ""
