# ShadowGraph

![Visitor Count](https://visitor-badge.laobi.icu/badge?page_id=sadiasakharkar.ShadowGraph)


ShadowGraph is a cinematic, single-scroll digital footprint intelligence platform that helps users discover where they appear online, understand their visibility, and take practical next steps.

## What This Build Includes

- Single-page cinematic landing experience (`/`)
- Single-scroll authenticated workspace (`/app/overview`) with modules revealed chapter-by-chapter
- End-to-end frontend + backend integration (React + FastAPI)
- Real auth, scans, summaries, insights, reports, profile dashboard

## Core User Modules

1. **Photo-Based Presence Search**

- Upload a photo and optionally add a name/handle.
- Returns face scan signals, likely profile matches, and public profile previews (where available).
- API: `POST /upload-face`

2. **Name/Handle Presence Search**

- Search by username or full name variants across many public platforms.
- API: `POST /scan-username`

3. **Digital Footprint Summary**

- Aggregated view of accounts, active platforms, categories, research, and breach counts.
- API: `GET /digital-footprint-summary`

4. **Research Paper Detection**

- Finds publication records with author matching, title, source, year, summary, and links.
- API: `POST /search-research`

5. **Reputation Insight**

- Actionable visibility and exposure insights with practical recommendations.
- API: `GET /reputation-insight`

6. **Profile & Dashboard**

- User profile, stats, activity overview, top platforms.
- API: `GET /profile-dashboard`

7. **AI Narrative + Privacy Alerts**

- Story blocks summarizing footprint and warning cards for exposure patterns.
- APIs: `GET /ai-narrative`, `GET /privacy-alerts`

8. **Skill Radar + Networking Opportunities**

- Skill map, growth gaps, and community/collaboration suggestions.
- APIs: `GET /skill-radar`, `GET /networking-opportunities`

9. **Timeline + Persona Score + Achievements**

- Activity timeline, public persona score, and gamified badges.
- APIs: `GET /activity-timeline`, `GET /public-persona-score`, `GET /achievements`

10. **Predictive Analytics + Ethical Verification**

- Forecasted visibility trend and ethical verification checklist.
- APIs: `GET /predictive-analytics`, `GET /ethical-verification`

11. **Reports**

- Export PDF and JSON reports.
- APIs: `GET /report/export/pdf`, `GET /report/export/json`

## Tech Stack

### Frontend

- React + Vite
- Tailwind CSS
- Framer Motion
- React Router
- Axios

### Backend

- FastAPI
- SQLAlchemy + SQLite
- JWT auth
- OAuth (Google/GitHub)
- ReportLab (PDF export)

## Run Locally

### 1) Backend

```bash
cd backend
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt -r requirements-dev.txt
cp .env.example .env
python3 -m uvicorn app.main:app --reload --host 127.0.0.1 --port 8000
```

### 2) Frontend

```bash
cd frontend
npm install
cp .env.example .env
npm run dev
```

Frontend: `http://localhost:5173`
Backend: `http://127.0.0.1:8000`

## Environment Notes

Frontend `.env`:

- `VITE_API_BASE_URL=http://localhost:8000`
- `VITE_OAUTH_REDIRECT_URI=http://localhost:5173/auth`

Backend `.env`:

- `SHADOWGRAPH_SECRET_KEY` (required)
- `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` (optional for Google OAuth)
- `GITHUB_CLIENT_ID`, `GITHUB_CLIENT_SECRET` (optional for GitHub OAuth)
- `HIBP_API_KEY` (optional breach live lookup)

## API Overview

### Auth

- `POST /auth/signup`
- `POST /auth/login`
- `GET /auth/me`
- `GET /auth/oauth/{provider}/start-url`
- `POST /auth/oauth/{provider}/exchange`

### Presence + Intelligence

- `POST /upload-face`
- `POST /scan-username`
- `GET /digital-footprint-summary`
- `GET /reputation-insight`
- `POST /search-research`
- `POST /check-breach`

### Narrative + Analytics

- `GET /ai-narrative`
- `GET /privacy-alerts`
- `GET /skill-radar`
- `GET /networking-opportunities`
- `GET /activity-timeline`
- `GET /public-persona-score`
- `GET /achievements`
- `GET /predictive-analytics`
- `GET /ethical-verification`
- `GET /profile-dashboard`

### Reports + Ops

- `GET /graph-data`
- `GET /report/history`
- `GET /report/export/pdf`
- `GET /report/export/json`
- `GET /audit/events`
- `POST /scrape-aggregate`
- `POST /jobs/scrape`
- `GET /jobs/scrape`
- `POST /crawler/schedules`
- `GET /crawler/schedules`

## Testing

### Backend

```bash
cd backend
source .venv/bin/activate
pytest -q
```

### Frontend build

```bash
cd frontend
npm run build
```

## Ethical Scope

ShadowGraph is designed to analyze **publicly accessible data only**.

- No private account access
- No credential stuffing or unauthorized scraping
- No bypassing authentication walls
- Results depend on platform accessibility, legal policy, and public availability

## Deployment Notes

- Frontend: Vercel / Netlify
- Backend: Railway / Render / Fly.io
- Replace SQLite with PostgreSQL for multi-user production environments
- Use Redis for robust distributed rate limiting in production
