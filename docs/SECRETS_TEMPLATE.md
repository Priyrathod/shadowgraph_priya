# Secrets Template

Fill these in your secret manager (or `.env` for local dev):

- SHADOWGRAPH_SECRET_KEY=
- SHADOWGRAPH_JWT_KEYS=
- REDIS_URL=
- HIBP_API_KEY=
- GOOGLE_CLIENT_ID=
- GOOGLE_CLIENT_SECRET=
- GITHUB_CLIENT_ID=
- GITHUB_CLIENT_SECRET=

Recommended:
- Keep JWT keys out of git.
- Use rotation with `SHADOWGRAPH_JWT_KEYS`.
- Use separate values per environment (dev/staging/prod).
