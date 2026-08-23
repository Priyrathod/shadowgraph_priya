# OAuth Setup (Google + GitHub)

## Callback URLs
Register exactly:
- `http://localhost:5173/auth?provider=google`
- `http://localhost:5173/auth?provider=github`

## Google
1. Open Google Cloud Console > APIs & Services > Credentials.
2. Create OAuth 2.0 Client ID (Web application).
3. Add callback URL above.
4. Set env vars:
   - `GOOGLE_CLIENT_ID`
   - `GOOGLE_CLIENT_SECRET`

## GitHub
1. Open GitHub Developer Settings > OAuth Apps.
2. Create app with callback URL above.
3. Set env vars:
   - `GITHUB_CLIENT_ID`
   - `GITHUB_CLIENT_SECRET`

## Verify
`GET /ops/readiness` should show:
- `google_oauth_configured: true`
- `github_oauth_configured: true`
