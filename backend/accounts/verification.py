"""Security checks for uploaded resumes."""
import re
from urllib.parse import urlparse

SUSPICIOUS_DOMAINS = {
    "xyz", "top", "work", "click", "buzz", "tk", "ml", "ga", "cf", "gq",
}

SHORTENER_DOMAINS = {
    "bit.ly", "tinyurl.com", "cutt.ly", "is.gd", "t.co", "ow.ly", "rb.gy", "shorturl.at", "grabify.link",
}


def verify_candidate_resume_security(file_name: str, file_bytes: bytes, raw_text: str):
    """
    Verifies candidate resume:
    1. Only Word (.docx, .doc) or PDF (.pdf) files are acceptable.
    2. Checks for phishing URLs, IP-address links, or suspicious shorteners.
    3. Checks for unstructured or non-standard format.

    Returns:
        dict: {
            "valid": bool,
            "error_type": None | "invalid_extension" | "phishing_url" | "unstructured_format",
            "message": str,
            "detected_phishing_urls": list,
        }
    """
    ext = (file_name.rsplit(".", 1)[-1] if "." in file_name else "").lower()
    if ext not in ("pdf", "docx", "doc"):
        return {
            "valid": False,
            "error_type": "invalid_extension",
            "message": f"Invalid file format '.{ext}'. Only PDF (.pdf) and Word (.docx, .doc) documents are accepted.",
            "detected_phishing_urls": [],
        }

    # URL extraction
    url_pattern = re.compile(
        r"https?://(?:www\.)?[-a-zA-Z0-9@:%._+~#=]{1,256}\.[a-zA-Z0-9()]{1,6}\b[-a-zA-Z0-9()@:%_+.~#?&/=]*|"
        r"www\.[-a-zA-Z0-9@:%._+~#=]{1,256}\.[a-zA-Z0-9()]{1,6}\b[-a-zA-Z0-9()@:%_+.~#?&/=]*",
        re.IGNORECASE,
    )

    found_urls = url_pattern.findall(raw_text or "")
    detected_phishing = []

    ip_pattern = re.compile(r"https?://(?:\d{1,3}\.){3}\d{1,3}", re.IGNORECASE)

    for url in found_urls:
        url_lower = url.lower()
        # IP address URL detection
        if ip_pattern.search(url_lower):
            detected_phishing.append(f"{url} (Raw IP URL indicator)")
            continue

        # Shorteners often used to mask malicious sites in resumes
        for shortener in SHORTENER_DOMAINS:
            if shortener in url_lower:
                detected_phishing.append(f"{url} (Suspicious redirect/shortener service)")
                break

        # Suspicious keywords in URL query / path
        suspicious_keywords = ["login", "signin", "verify-account", "update-password", "banking", "secure-token"]
        if any(kw in url_lower for kw in suspicious_keywords) and not ("linkedin.com" in url_lower or "github.com" in url_lower):
            detected_phishing.append(f"{url} (Suspicious credential/phishing URL path)")

        # Suspicious TLDs
        try:
            parsed = urlparse(url if "://" in url else f"http://{url}")
            host = parsed.hostname or ""
            tld = host.split(".")[-1] if "." in host else ""
            if tld in SUSPICIOUS_DOMAINS:
                detected_phishing.append(f"{url} (High-risk deceptive domain TLD .{tld})")
        except Exception:
            pass

    if detected_phishing:
        return {
            "valid": False,
            "error_type": "phishing_url",
            "message": f"Resume rejected by system: Deceptive or phishing URL detected ({', '.join(detected_phishing[:2])}).",
            "detected_phishing_urls": detected_phishing,
        }

    # Format structure check: standard resume sections and word count
    clean_text = (raw_text or "").strip()
    words = clean_text.split()
    if len(words) < 25:
        return {
            "valid": False,
            "error_type": "unstructured_format",
            "message": "Resume rejected by system: Unstructured format or insufficient content. Does not align with standard resume structure.",
            "detected_phishing_urls": [],
        }

    standard_sections = ["experience", "education", "skills", "projects", "work", "employment", "summary", "profile", "contact", "objective"]
    found_sections = [sec for sec in standard_sections if re.search(r"\b" + sec + r"\b", clean_text, re.IGNORECASE)]

    if len(found_sections) < 2:
        return {
            "valid": False,
            "error_type": "unstructured_format",
            "message": "Resume rejected by system: Missing standard resume sections (e.g. Experience, Skills, Education). Unstructured format.",
            "detected_phishing_urls": [],
        }

    return {
        "valid": True,
        "error_type": None,
        "message": "Resume verified: Valid structure and security check passed.",
        "detected_phishing_urls": [],
    }
