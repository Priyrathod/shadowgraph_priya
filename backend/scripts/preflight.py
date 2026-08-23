#!/usr/bin/env python3
import os
import sys
from urllib.parse import urlparse

try:
    from dotenv import load_dotenv
    load_dotenv()
except Exception:
    pass


def masked(value: str) -> str:
    if not value:
        return '<missing>'
    if len(value) <= 8:
        return '*' * len(value)
    return f"{value[:4]}...{value[-4:]}"


def check_secret_quality(secret: str) -> tuple[bool, str]:
    if not secret:
        return False, 'missing'
    if secret == 'change-me' or secret == 'change-this-in-production-shadowgraph':
        return False, 'default placeholder value'
    if len(secret) < 24:
        return False, 'too short (use 24+ chars)'
    return True, 'ok'


def check_redis(url: str) -> tuple[bool, str]:
    if not url:
        return False, 'missing (rate-limit falls back to in-memory)'
    try:
        p = urlparse(url)
        if p.scheme not in ('redis', 'rediss'):
            return False, 'invalid scheme'
        if not p.hostname:
            return False, 'missing host'
    except Exception as exc:
        return False, f'invalid URL: {exc}'
    return True, 'ok'


def main() -> int:
    print('== ShadowGraph Backend Preflight ==')

    secret = os.getenv('SHADOWGRAPH_SECRET_KEY', '')
    secret_ok, secret_msg = check_secret_quality(secret)
    print(f"SHADOWGRAPH_SECRET_KEY: {masked(secret)} [{secret_msg}]")

    jwt_keys = os.getenv('SHADOWGRAPH_JWT_KEYS', '')
    if jwt_keys:
        keys = [k.strip() for k in jwt_keys.split(',') if k.strip()]
        print(f"SHADOWGRAPH_JWT_KEYS: {len(keys)} keys configured")
    else:
        print('SHADOWGRAPH_JWT_KEYS: <missing> (optional, recommended for rotation)')

    redis_url = os.getenv('REDIS_URL', '')
    redis_ok, redis_msg = check_redis(redis_url)
    print(f"REDIS_URL: {masked(redis_url)} [{redis_msg}]")

    print('\nOAuth/HIBP status:')
    for key in ['HIBP_API_KEY', 'GOOGLE_CLIENT_ID', 'GOOGLE_CLIENT_SECRET', 'GITHUB_CLIENT_ID', 'GITHUB_CLIENT_SECRET']:
        print(f"- {key}: {masked(os.getenv(key, ''))}")

    failures = []
    if not secret_ok:
        failures.append('Set a strong SHADOWGRAPH_SECRET_KEY')

    print('\nResult:')
    if failures:
        for item in failures:
            print(f"- FAIL: {item}")
        print('\nPreflight failed.')
        return 1

    print('- PASS: required baseline checks satisfied.')
    if not redis_ok:
        print('- WARN: Redis missing/invalid; distributed rate limiting disabled.')
    print('\nPreflight complete.')
    return 0


if __name__ == '__main__':
    sys.exit(main())
