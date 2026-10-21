"""
Verification utilities for candidate resumes and recruiter corporate affiliations.
Prevents fake recruiter accounts and fake/malicious candidate registrations.
"""
import re
from urllib.parse import urlparse

FREE_EMAIL_DOMAINS = {
    "gmail.com", "yahoo.com", "hotmail.com", "outlook.com", "live.com",
    "aol.com", "icloud.com", "mail.com", "zoho.com", "proton.me",
    "protonmail.com", "yandex.com", "gmx.com", "fastmail.com",
    "tempmail.com", "10minutemail.com", "guerrillamail.com", "trashmail.com",
}

SUSPICIOUS_DOMAINS = {
    "xyz", "top", "work", "click", "buzz", "tk", "ml", "ga", "cf", "gq",
}

SHORTENER_DOMAINS = {
    "bit.ly", "tinyurl.com", "cutt.ly", "is.gd", "t.co", "ow.ly", "rb.gy", "shorturl.at", "grabify.link",
}


def clean_domain(url_or_domain: str) -> str:
    """Extract clean base domain from a URL or email domain string."""
    text = (url_or_domain or "").strip().lower()
    if not text:
        return ""
    if "://" in text:
        try:
            parsed = urlparse(text)
            text = parsed.hostname or text
        except Exception:
            pass
    text = re.sub(r"^www\.", "", text)
    text = text.split("/")[0].split(":")[0]
    return text


def verify_recruiter_profile(email: str, company_name: str, company_website: str):
    """
    Verifies whether a recruiter email belongs to the claimed company domain.
    Returns: (is_verified: bool, notes: str)
    """
    email_clean = (email or "").strip().lower()
    if "@" not in email_clean:
        return False, "Invalid recruiter email address provided."

    email_domain = email_clean.split("@")[-1].strip().lower()
    comp_domain = clean_domain(company_website)

    # 1. Reject or flag disposable / free public email providers for recruiter roles
    if email_domain in FREE_EMAIL_DOMAINS:
        return False, (
            f"Registration uses a free email provider (@{email_domain}). "
            f"Recruiter role requires a corporate email matching '{company_name or 'the company'}' "
            f"or administrator verification."
        )

    # 2. Check corporate website domain match if provided
    if comp_domain:
        # Check direct match or subdomain match (e.g. google.com and corp.google.com)
        if email_domain == comp_domain or email_domain.endswith("." + comp_domain) or comp_domain.endswith("." + email_domain):
            return True, f"Verified: Recruiter email domain (@{email_domain}) successfully matches company domain ({comp_domain})."
        else:
            return False, (
                f"Domain mismatch: Recruiter email domain (@{email_domain}) does not match "
                f"company website ({comp_domain}). Subject to manual verification."
            )

    # 3. If legitimate custom corporate domain without explicit website
    if "." in email_domain and email_domain not in FREE_EMAIL_DOMAINS:
        return True, f"Verified corporate email domain (@{email_domain}) for {company_name or 'the organization'}."

    return False, "Unable to verify company corporate domain."


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
