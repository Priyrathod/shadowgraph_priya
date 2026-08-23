# ShadowGraph Backend

## Run

```bash
cd backend
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
pip install -r requirements-dev.txt
cp .env.example .env
alembic upgrade head
uvicorn app.main:app --reload --port 8000
```

## Live Modules

- Authentication + JWT + SQLite
- OAuth backend (Google + GitHub)
- Face recognition (embedding matching)
- Fake detection (DeepFace primary, heuristic fallback)
- Username discovery (live probes)
- Web scraping & aggregation engine
- Background scrape job queue
- Crawler scheduling + monitoring APIs
- Research detection (Crossref)
- Breach monitor (HIBP)
- Risk scoring
- Dynamic graph generation
- Settings persistence + account deletion
- Report history + PDF export
- Audit events feed

## Security / Hardening

- Redis-backed distributed rate limit (fallback in-memory)
- Login lockout abuse control
- Security headers + request IDs + response timing headers
- JWT key ring rotation support (`SHADOWGRAPH_JWT_KEYS`)
- Strict CORS from env

## Important Endpoints

- Auth: `/auth/signup`, `/auth/login`, `/auth/me`
- OAuth: `/auth/oauth/{provider}/start-url`, `/auth/oauth/{provider}/exchange`
- Face: `/upload-face`
- Username: `/scan-username`
- Scrape sync: `/scrape-aggregate`
- Scrape jobs: `/jobs/scrape`, `/jobs/scrape/{job_id}`
- Crawler schedules: `/crawler/schedules`
- Research: `/search-research`
- Breach: `/check-breach`
- Risk: `/calculate-risk`
- Graph: `/graph-data`
- Reports: `/report/history`, `/report/export/pdf`
- Settings: `/settings`, `/account`
- Audit: `/audit/events`
- Readiness: `/ops/readiness`

## Ops Setup Docs

- `../docs/OAUTH_SETUP.md`
- `../docs/OPS_SETUP.md`
- `../docs/FACE_QUALITY.md`
