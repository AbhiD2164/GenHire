# GenHire — Smart Hiring Platform

A full-stack LinkedIn-style job portal with an intelligent, API-key-free ATS resume screener.
Built with **React + Vite** (frontend) and **Django REST Framework** (backend).

---

## What makes GenHire different

| Feature | Detail |
|---|---|
| **Hard-gated ATS screening** | Resumes are parsed and scored on submit. Below-threshold applicants see "not suitable" and **never reach the recruiter's view** — not even in a "rejected" tab. |
| **Any industry, any role** | Skills are recruiter-defined per job (comma-separated). Works for nursing, welding, finance, teaching, IT, sales — anything. No hardcoded taxonomy. |
| **No API key required** | All parsing is done with pure Python (pdfminer.six + python-docx + pycountry). Zero external API calls, zero cost per resume. |
| **Structured experience extraction** | Parses month/year date ranges from resumes, merges overlapping jobs, computes total career months, and compares against the job's min/max requirement window. |
| **Location extraction** | Detects city/country from resume header using 200+ major cities, pycountry country names, and Indian state names — no geocoding API needed. |
| **LinkedIn-style feed** | Posts (updates, job announcements, project builds, articles), likes, comments, connection requests — all role-agnostic. |

---

## Project structure

```
GenHire/
├── backend/          # Django REST Framework API
│   ├── accounts/     # Auth, profiles, work experience
│   ├── jobs/         # Job postings, applications, apply flow
│   ├── ats/          # Resume parsing engine
│   │   ├── engine.py              # Main pipeline orchestrator
│   │   ├── text_extraction.py     # PDF + DOCX text extraction
│   │   ├── experience_extraction.py # Month/year date range parsing
│   │   ├── skill_extraction.py    # Generic skill matching
│   │   └── location_extraction.py # City/country detection
│   ├── network/      # Feed, posts, likes, comments, connections
│   └── GenHire/      # Django project settings + root URLs
└── frontend/         # React + Vite SPA
    └── src/
        ├── api/      # Axios API client modules
        ├── context/  # Auth + Toast context providers
        ├── components/ # Navbar, ProtectedRoute, StatusPill
        ├── pages/    # All route-level page components
        └── styles/   # CSS design tokens + component styles
```

---

## Prerequisites

- **Python 3.10+**
- **Node.js 18+** and npm
- No other external services required

---

## Setup — Backend

```bash
cd backend

# 1. Create and activate virtual environment
python -m venv venv
# Windows:
venv\Scripts\activate
# macOS/Linux:
source venv/bin/activate

# 2. Install dependencies
pip install -r requirements.txt

# 3. Copy env file and edit if needed
cp .env.example .env

# 4. Run database migrations
python manage.py migrate

# 5. Create an admin superuser (optional, for /admin panel)
python manage.py createsuperuser

# 6. Start the development server
python manage.py runserver
```

The API will be available at `http://localhost:8000/api/`

Django admin: `http://localhost:8000/admin/`

---

## Setup — Frontend

```bash
cd frontend

# 1. Install dependencies
npm install

# 2. Start development server
npm run dev
```

The app will be available at `http://localhost:5173`

> The Vite dev server proxies all `/api` and `/media` requests to `localhost:8000` automatically — no CORS setup needed during development.

---

## Quick start walkthrough

1. Open `http://localhost:5173` and click **Sign up**
2. Create a **Recruiter** account, then log in
3. Go to **Jobs → Post a job**, fill in any industry (e.g. "Head Nurse, Healthcare") and paste comma-separated required skills (e.g. `nursing, patient care, CPR, EMR`)
4. Log out, sign up as a **Job seeker**
5. Browse jobs, click **Submit application**, upload a PDF or DOCX resume
6. Instantly see **"Your application is sent successfully!"** or **"Oops! Your application is not suitable for this job role."**
7. Log back in as the recruiter → **Dashboard → View applicants** — only passed candidates appear

---

## ATS scoring explained

The ATS engine runs synchronously when a candidate submits — no background workers needed.

### Score formula

```
final_score = (skill_score × 0.7) + (experience_score × 0.3)
```

**Skill score** — required skills are weighted 2×, good-to-have 1×. The engine uses a synonym table (e.g. "NodeJS" = "Node.js" = "Node") plus word-boundary regex for skills not in the table, so arbitrary skills from any domain work out of the box.

**Experience score** — candidate's merged total months vs job's minimum:
- Meets/exceeds minimum → 1.0
- Below minimum → linear partial credit (months / min_months)
- No minimum set → always 1.0

### Decision thresholds (configurable in `settings.py`)

| Score range | Status | Recruiter sees? | Candidate message |
|---|---|---|---|
| ≥ 0.70 | **Selected** | ✅ Yes | "Your application is sent successfully!" |
| 0.40 – 0.69 | **Consider** | ✅ Yes | "Your application is sent successfully!" |
| < 0.40 | **Rejected** | ❌ Never | "Oops! Your application is not suitable for this job role." |

Change thresholds by editing `ATS_SELECT_THRESHOLD` and `ATS_CONSIDER_THRESHOLD` in `backend/GenHire/settings.py`.

---

## API reference (key endpoints)

| Method | Endpoint | Description |
|---|---|---|
| POST | `/api/auth/signup/` | Register new user |
| POST | `/api/auth/login/` | Get JWT tokens |
| GET/PATCH | `/api/auth/me/` | View/edit own profile |
| GET | `/api/auth/profile/<id>/` | View public profile |
| GET/POST | `/api/auth/experience/` | List/add work experience |
| GET | `/api/auth/candidates/search/` | Search candidates (recruiter) |
| GET/POST | `/api/jobs/` | List jobs / post a job |
| GET | `/api/jobs/<id>/` | Job detail |
| POST | `/api/jobs/<id>/apply/` | Apply with resume (multipart) |
| GET | `/api/jobs/<id>/applications/` | View applicants (recruiter, hard-gated) |
| GET | `/api/jobs/my-applications/` | Applicant's own history |
| GET/POST | `/api/network/feed/` | Read feed / create post |
| POST | `/api/network/posts/<id>/like/` | Toggle like |
| GET/POST | `/api/network/posts/<id>/comments/` | Read / add comments |
| POST | `/api/network/connections/request/<user_id>/` | Send connection request |
| POST | `/api/network/connections/respond/<id>/` | Accept or decline |
| GET | `/api/network/connections/me/` | My connections + pending |

All endpoints (except signup/login) require `Authorization: Bearer <access_token>`.

---

## Production deployment notes

1. Set `DJANGO_DEBUG=False` and provide a strong `DJANGO_SECRET_KEY` in `.env`
2. Run `python manage.py collectstatic` and serve `staticfiles/` from nginx/CDN
3. Use gunicorn: `gunicorn GenHire.wsgi:application --bind 0.0.0.0:8000`
4. Serve `media/` files from nginx (not Django) in production
5. Build the frontend: `npm run build` — serve `dist/` from nginx or any static host
6. Update `CORS_ALLOWED_ORIGINS` in `settings.py` to your production domain

---

## Tech stack

| Layer | Technology |
|---|---|
| Frontend | React 18, Vite, React Router v7, Axios |
| Backend | Django 4.2+, Django REST Framework, SimpleJWT |
| Resume parsing | pdfminer.six (PDF), python-docx (DOCX) |
| Location detection | pycountry + curated city list |
| Image handling | Pillow |
| Database | SQLite (dev) — swap to PostgreSQL for production |
| Auth | JWT (access 12h, refresh 7d, auto-rotation) |
