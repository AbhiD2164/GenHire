# GenHire — Smart Hiring Platform

A full-stack LinkedIn-style job portal with an intelligent, API-key-free ATS resume screener.
Built with **React + Vite** (frontend) and **Django REST Framework** (backend).

---

## What makes GenHire different

| Feature | Detail |
|---|---|
| **Resume screening** | Resumes are parsed and scored on submit using skills, experience, and role relevance. Job owners can review and update application decisions. |
| **Any industry, any role** | Skills and optional education requirements are defined per job. Matching works across nursing, welding, finance, teaching, IT, sales, and more. |
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
│   │   ├── matching_features.py   # Resume/job features for recommendations
│   │   └── location_extraction.py # City/country detection
│   ├── ml/           # Supervised job-matching trainer
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
2. Create one professional account; no recruiter/job-seeker account type is needed
3. Post a job from **Jobs → Post a job**, adding skills and optional education requirements
4. A different member can apply with a PDF or DOCX resume
5. The job owner can review applications, update decisions, and invite applicants to interviews or assessments
6. Members can manage their professional profile, connections, and application updates from the dashboard

---

## ATS scoring explained

The ATS engine runs synchronously when a member applies — no background workers needed.

### Score formula

```
final_score = (skill_score × 0.60) + (experience_score × 0.25) + (role_relevance × 0.15)
```

**Skill score** — required skills are weighted 2×, good-to-have 1×. The engine uses a synonym table (e.g. "NodeJS" = "Node.js" = "Node") plus word-boundary matching for job-defined skills.

**Experience score** — applicant's merged total months compared with the job's minimum:
- Meets/exceeds minimum → 1.0
- Below minimum → linear partial credit (months / min_months)
- No minimum set → 1.0

**Role relevance** — text similarity between the resume and the job title, description, and requirements.

### Decision thresholds (configurable in `settings.py`)

| Score range | Status | Job owner sees? | Applicant message |
|---|---|---|---|
| ≥ 0.80 | **Selected** | Yes | Strong-match application update |
| 0.60 – 0.79 | **Applied** | Yes | Application received and in review |
| < 0.60 | **Rejected** | Yes | Application update with the score/reason |

Thresholds are configured with `ATS_PERFECT_THRESHOLD` and `ATS_PARTIAL_THRESHOLD` in `backend/GenHire/settings.py`. Automated outcomes are not used as training labels.

## Job recommendation model

Recommendations combine profile/resume text with structured skill coverage, experience duration, and education-requirement features. Before a trained model is available, the app clearly identifies its content-similarity fallback.

To train the supervised model after collecting enough human-reviewed outcomes, run:

```bash
cd backend
python manage.py train_recommender
```

Training uses only explicit job-owner selections/rejections, not automated ATS outcomes or synthetic negatives. It requires at least 20 reviewed applications, at least five outcomes of each class, at least five distinct applicants, and a user-separated validation split. The command reports a clear error instead of writing an artifact when those requirements are not met. A successful run stores a versioned artifact in `ML_MODEL_DIR`; restart the backend service after training so workers load it.

---

## API reference (key endpoints)

| Method | Endpoint | Description |
|---|---|---|
| POST | `/api/auth/signup/` | Register new user |
| POST | `/api/auth/login/` | Get JWT tokens |
| GET/PATCH | `/api/auth/me/` | View/edit own profile |
| GET | `/api/auth/profile/<id>/` | View public profile |
| GET/POST | `/api/auth/experience/` | List/add work experience |
| GET | `/api/auth/people/search/` | Search people by skills, location, and experience |
| GET | `/api/auth/candidates/search/` | Compatibility alias for people search |
| GET/POST | `/api/jobs/` | List jobs / post a job |
| GET | `/api/jobs/<id>/` | Job detail |
| POST | `/api/jobs/<id>/apply/` | Apply with resume (multipart) |
| GET | `/api/jobs/<id>/applications/` | View applications for a job you posted |
| GET | `/api/jobs/my-applications/` | View your application history |
| GET | `/api/jobs/my-posted-jobs/` | View jobs you posted |
| GET/POST | `/api/network/feed/` | Read feed / create post |
| POST | `/api/network/posts/<id>/like/` | Toggle like |
| GET/POST | `/api/network/posts/<id>/comments/` | Read / add comments |
| POST | `/api/network/connections/request/<user_id>/` | Send connection request |
| POST | `/api/network/connections/respond/<id>/` | Accept or decline |
| GET | `/api/network/connections/me/` | My connections + pending |

All endpoints (except signup/login) require `Authorization: Bearer <access_token>`.

---

## Production deployment notes

1. On Render, create a web service rooted at `backend/` with build command `pip install -r requirements.txt && python manage.py migrate && python manage.py collectstatic --noinput` and start command `gunicorn GenHire.wsgi:application --bind 0.0.0.0:$PORT`.
2. Set `DJANGO_DEBUG=False`, a strong `DJANGO_SECRET_KEY`, and Neon’s pooled `DATABASE_URL` with `sslmode=require`. `dj-database-url` reads this automatically.
3. Configure production mail with `EMAIL_BACKEND=django.core.mail.backends.smtp.EmailBackend`, `EMAIL_HOST`, `EMAIL_PORT`, `EMAIL_HOST_USER`, `EMAIL_HOST_PASSWORD`, `EMAIL_USE_TLS=True`, and `DEFAULT_FROM_EMAIL`. Without these, signup OTP and reset emails are not delivered.
4. Set `FRONTEND_URL=https://<your-vercel-domain>` and `VITE_API_BASE=https://<your-render-domain>/api` in Vercel. The frontend otherwise defaults to localhost.
5. Set `GOOGLE_CLIENT_ID` on Render and `VITE_GOOGLE_CLIENT_ID` on Vercel, and add the Vercel origin to Google’s authorized origins.
6. Do not use local `media/` storage for production resumes/avatars: Render’s filesystem is ephemeral. Configure durable object storage before enabling real resume uploads.
7. Render free instances may sleep, so synchronous resume parsing and cold starts can be slow.
8. The repository includes `render.yaml` for the backend service and `/health/` for Render health checks. Review the `sync: false` environment variables in the Render dashboard before deploying.
9. API throttling is enabled at 30 requests/minute for anonymous clients and 300 requests/minute for authenticated users to protect free-tier resources.

The project implements email OTP verification, JWT login, password-reset links, Google ID-token verification, and role authorization. It does **not** implement mobile-number storage, SMS OTP delivery, or a device approval popup. Those require a phone field, an SMS provider such as Twilio/MessageBird, rate limits, consent/audit records, and a separate verification flow.

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
