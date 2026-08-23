# Go-Live Checklist

## 1. Backend environment

Create/update `backend/.env` with real values:
- `SHADOWGRAPH_SECRET_KEY` (strong secret, 24+ chars)
- Optional rotation: `SHADOWGRAPH_JWT_KEYS`
- `REDIS_URL`
- `HIBP_API_KEY`
- OAuth values:
  - `GOOGLE_CLIENT_ID`
  - `GOOGLE_CLIENT_SECRET`
  - `GITHUB_CLIENT_ID`
  - `GITHUB_CLIENT_SECRET`

## 2. OAuth provider console

Register callback URIs:
- `http://localhost:5173/auth?provider=google`
- `http://localhost:5173/auth?provider=github`

## 3. Install dependencies

```bash
make backend-install
make frontend-install
```

## 4. Runtime checks

```bash
make backend-preflight
make backend-runtime
```

## 5. Migrate DB

```bash
make backend-migrate
```

## 6. Run backend/frontend

Terminal 1:
```bash
make backend-run
```

Terminal 2:
```bash
cd frontend && npm run dev
```

## 7. Automated tests

Backend:
```bash
make backend-test
```

Frontend e2e (requires frontend app running):
```bash
make frontend-test
```

## 8. Readiness endpoint

Check:
- `http://localhost:8000/ops/readiness`

All checks should be true for production readiness.

## 9. Deploy

- Docker local: `docker-compose up --build`
- CI runs on push/PR (`.github/workflows/ci.yml`)
- K8s manifests in `infra/k8s/`
