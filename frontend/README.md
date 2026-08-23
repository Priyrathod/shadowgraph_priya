# ShadowGraph Frontend

## Setup

```bash
npm install
cp .env.example .env
npm run dev
```

## Environment

- `VITE_API_BASE_URL` (default `http://localhost:8000`)
- `VITE_OAUTH_REDIRECT_URI` (default `<origin>/auth`, example `http://localhost:5173/auth`)

## Integrated Pages

- `/app/scrape` - web scraping & aggregation engine UI
- `/app/reports` - report history + PDF export
- `/app/ops` - crawler jobs, schedules, and audit monitoring
- `/app/settings` - persistent settings + delete account

## E2E Tests

```bash
npm run test:e2e
```
