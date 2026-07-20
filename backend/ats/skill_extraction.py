"""
Generic skill/keyword extraction and matching.

The original engine hardcoded an IT-only SKILL_MAP (html, react, django...).
This version is role-agnostic: instead of relying on a fixed taxonomy, the
job itself defines which skills/keywords matter (via Job.skills_required /
good_to_have, entered by the recruiter for ANY industry — nursing, sales,
carpentry, accounting, teaching, etc). The engine's job is simply to:

  1. Normalize both the resume text and the requirement strings consistently.
  2. Recognize common multi-word variants/synonyms for the same skill so
     trivial phrasing differences ("Node.js" vs "NodeJS" vs "Node") don't
     cause false negatives.
  3. Fall back to fuzzy substring/word-boundary matching for anything not
     in the synonym table, so it still works for skills nobody anticipated
     (e.g. "CNC machining", "patient triage", "GAAP", "Adobe Illustrator").

This makes the matcher usable for literally any domain because the
"taxonomy" is supplied per-job at request time, not baked into the code.
"""
import re

# A general-purpose synonym table covering common variants across many
# industries (not just software). Recruiters can still type any skill not
# listed here — it will simply use exact/word-boundary matching.
SKILL_SYNONYMS = {
    # --- tech (kept, since many jobs still need it) ---
    "html": ["html", "html5"],
    "css": ["css", "css3"],
    "javascript": ["javascript", "js", "es6", "ecmascript"],
    "typescript": ["typescript", "ts"],
    "react": ["react", "reactjs", "react.js"],
    "node.js": ["node", "nodejs", "node.js"],
    "express": ["express", "expressjs", "express.js"],
    "mongodb": ["mongo", "mongodb"],
    "sql": ["sql", "mysql", "postgresql", "postgres", "sqlite", "ms sql", "t-sql"],
    "django": ["django"],
    "python": ["python", "py"],
    "java": ["java"],
    "c++": ["c++", "cpp"],
    "excel": ["excel", "ms excel", "microsoft excel", "spreadsheets"],

    # --- sales / marketing ---
    "seo": ["seo", "search engine optimization"],
    "crm": ["crm", "salesforce", "hubspot", "zoho crm"],
    "cold calling": ["cold calling", "cold call", "outbound calling"],
    "lead generation": ["lead generation", "lead gen", "prospecting"],
    "digital marketing": ["digital marketing", "online marketing"],
    "social media marketing": ["social media marketing", "smm"],
    "negotiation": ["negotiation", "negotiating"],

    # --- finance / accounting ---
    "gaap": ["gaap", "generally accepted accounting principles"],
    "bookkeeping": ["bookkeeping", "book-keeping"],
    "tally": ["tally", "tally erp", "tally erp 9"],
    "financial modeling": ["financial modeling", "financial modelling"],
    "taxation": ["taxation", "tax filing", "income tax"],
    "auditing": ["auditing", "audit"],

    # --- healthcare ---
    "patient care": ["patient care", "patient management"],
    "phlebotomy": ["phlebotomy"],
    "cpr": ["cpr", "cardiopulmonary resuscitation"],
    "emr": ["emr", "electronic medical records", "ehr", "electronic health records"],
    "nursing": ["nursing", "registered nurse", "rn"],
    "triage": ["triage"],

    # --- education ---
    "lesson planning": ["lesson planning", "curriculum design", "curriculum development"],
    "classroom management": ["classroom management"],

    # --- hr ---
    "recruitment": ["recruitment", "talent acquisition", "hiring"],
    "onboarding": ["onboarding", "induction"],
    "payroll": ["payroll", "payroll processing"],
    "performance management": ["performance management", "performance appraisal"],

    # --- design / creative ---
    "photoshop": ["photoshop", "adobe photoshop"],
    "illustrator": ["illustrator", "adobe illustrator"],
    "figma": ["figma"],
    "video editing": ["video editing", "premiere pro", "final cut pro"],

    # --- operations / logistics ---
    "supply chain management": ["supply chain management", "scm"],
    "inventory management": ["inventory management", "stock management"],
    "logistics": ["logistics"],
    "warehouse management": ["warehouse management"],

    # --- construction / manufacturing / trades ---
    "autocad": ["autocad", "auto cad"],
    "cnc machining": ["cnc machining", "cnc operation", "cnc machine"],
    "welding": ["welding"],
    "electrical wiring": ["electrical wiring", "electrical installation"],
    "plumbing": ["plumbing"],
    "carpentry": ["carpentry"],
    "blueprint reading": ["blueprint reading", "reading blueprints"],

    # --- hospitality ---
    "customer service": ["customer service", "customer support", "client service"],
    "food safety": ["food safety", "haccp"],
    "housekeeping": ["housekeeping"],

    # --- legal ---
    "contract drafting": ["contract drafting", "drafting contracts"],
    "legal research": ["legal research"],
    "litigation": ["litigation"],

    # --- general soft skills ---
    "communication": ["communication", "communication skills"],
    "leadership": ["leadership", "team leadership"],
    "project management": ["project management", "pmp"],
    "data analysis": ["data analysis", "data analytics"],
    "ms office": ["ms office", "microsoft office"],
}


def normalize_text(text):
    """Lowercase + strip punctuation but keep periods/numbers (helps e.g. 'node.js', 'c++' lookups still work via separate handling)."""
    text = text.lower()
    text = re.sub(r"[^a-z0-9\s.+#]", " ", text)
    text = re.sub(r"\s+", " ", text)
    return text.strip()


def parse_skill_list(raw):
    """Split a comma/semicolon-separated requirement string into a clean list."""
    if not raw:
        return []
    parts = re.split(r"[,;\n]", raw)
    return [p.strip().lower() for p in parts if p.strip()]


def skill_match(skill, normalized_resume_text):
    """
    Returns True if `skill` (already lowercased) is found in the resume
    text, using the synonym table when available, otherwise falling back
    to a direct word/phrase boundary search so arbitrary skills from any
    industry still work out of the box.
    """
    skill = skill.strip().lower()
    if not skill:
        return False

    if skill in SKILL_SYNONYMS:
        return any(_contains_phrase(alias, normalized_resume_text) for alias in SKILL_SYNONYMS[skill])

    return _contains_phrase(skill, normalized_resume_text)


def _contains_phrase(phrase, text):
    phrase = phrase.strip()
    if not phrase:
        return False
    # Escape regex special chars but keep it readable; word-boundary aware
    # for single tokens, simple substring for multi-word phrases (since
    # \b around phrases with internal punctuation like "c++" misbehaves).
    if re.match(r"^[a-z0-9]+$", phrase):
        return re.search(rf"\b{re.escape(phrase)}\b", text) is not None
    return phrase in text


def extract_present_skills(resume_text, candidate_skill_universe):
    """
    Given a normalized resume text and a list of candidate skills to check
    for (typically: job's required + good-to-have list, but can be any
    larger reference vocabulary), returns the subset found in the resume.
    Used to populate Application.parsed_skills / Profile.skills.
    """
    normalized = normalize_text(resume_text)
    found = []
    for skill in candidate_skill_universe:
        if skill_match(skill, normalized):
            found.append(skill)
    return found
