# Ops Setup

## HIBP
Set:
- `HIBP_API_KEY`

Verify:
- `GET /ops/readiness` -> `hibp_configured: true`

## JWT Secret Rotation
Use `SHADOWGRAPH_JWT_KEYS` as comma-separated keys.
- First key signs new tokens.
- All keys verify existing tokens.

Example:
`SHADOWGRAPH_JWT_KEYS=new_key,current_key,old_key`

After token expiry window passes, remove old keys.

## Redis Rate Limiting
Set:
- `REDIS_URL=redis://localhost:6379/0`

Without Redis, fallback is in-memory rate limiting.

## Migrations (Alembic)
```bash
cd backend
pip install -r requirements-dev.txt
alembic upgrade head
```
