import asyncio
import io
import json
import logging
import os
import re
import time
import uuid
from collections import defaultdict, deque
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Any
from urllib.parse import quote_plus, urlencode, urljoin, urlparse
import threading

import cv2
import httpx
import numpy as np
from bs4 import BeautifulSoup
from fastapi import Depends, FastAPI, File, Form, HTTPException, Request, UploadFile, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import OAuth2PasswordBearer
from jose import JWTError, jwt
from passlib.context import CryptContext
from pydantic import BaseModel, EmailStr, Field, field_validator, model_validator
from reportlab.lib.pagesizes import letter
from reportlab.pdfgen import canvas
from sqlalchemy import DateTime, ForeignKey, Integer, String, Text, create_engine
from sqlalchemy.orm import Mapped, Session, declarative_base, mapped_column, relationship, sessionmaker
from starlette.responses import StreamingResponse
from starlette.responses import JSONResponse
try:
    import redis.asyncio as redis_async
except Exception:  # pragma: no cover
    redis_async = None
try:
    from apscheduler.schedulers.asyncio import AsyncIOScheduler
except Exception:  # pragma: no cover
    AsyncIOScheduler = None

try:
    from deepface import DeepFace
except Exception:  # pragma: no cover
    DeepFace = None
try:
    import face_recognition
except Exception:  # pragma: no cover
    face_recognition = None

app = FastAPI(title='ShadowGraph API', version='0.3.0')
logger = logging.getLogger('shadowgraph')
logging.basicConfig(level=os.getenv('LOG_LEVEL', 'INFO'))

CORS_ORIGINS = [origin.strip() for origin in os.getenv('CORS_ORIGINS', 'http://localhost:5173,http://127.0.0.1:5173').split(',') if origin.strip()]
CORS_ORIGIN_REGEX = os.getenv('CORS_ORIGIN_REGEX', r'https://.*\.vercel\.app')
app.add_middleware(
    CORSMiddleware,
    allow_origins=CORS_ORIGINS,
    allow_origin_regex=CORS_ORIGIN_REGEX,
    allow_credentials=True,
    allow_methods=['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allow_headers=['Authorization', 'Content-Type', 'X-Request-Id'],
)

BASE_DIR = Path(__file__).resolve().parent
USERNAME_REGEX = re.compile(r'^[A-Za-z0-9_.-]{2,40}$')

JWT_KEY_RING = [k.strip() for k in os.getenv('SHADOWGRAPH_JWT_KEYS', '').split(',') if k.strip()]
SECRET_KEY = JWT_KEY_RING[0] if JWT_KEY_RING else os.getenv('SHADOWGRAPH_SECRET_KEY', 'change-this-in-production-shadowgraph')
VERIFY_KEYS = JWT_KEY_RING if JWT_KEY_RING else [SECRET_KEY]
ALGORITHM = 'HS256'
ACCESS_TOKEN_EXPIRE_MINUTES = int(os.getenv('ACCESS_TOKEN_EXPIRE_MINUTES', '1440'))
LOGIN_LOCK_WINDOW_SECONDS = int(os.getenv('LOGIN_LOCK_WINDOW_SECONDS', '900'))
LOGIN_MAX_FAILURES = int(os.getenv('LOGIN_MAX_FAILURES', '6'))

DB_PATH = BASE_DIR / 'shadowgraph.db'
DATABASE_URL = f'sqlite:///{DB_PATH}'
engine = create_engine(DATABASE_URL, connect_args={'check_same_thread': False})
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()
_schema_lock = threading.Lock()
_schema_ready = False

# Use PBKDF2-SHA256 for cross-platform stability (avoids bcrypt backend issues on some Python/macOS builds).
pwd_context = CryptContext(schemes=['pbkdf2_sha256'], deprecated='auto')
oauth2_scheme = OAuth2PasswordBearer(tokenUrl='/auth/login')

FACE_GALLERY_DIR = BASE_DIR / 'data' / 'face_gallery'
FACE_GALLERY_META = FACE_GALLERY_DIR / 'metadata.json'
FACE_DETECTOR = cv2.CascadeClassifier(str(Path(cv2.data.haarcascades) / 'haarcascade_frontalface_default.xml'))

PLATFORMS = [
    {'name': 'LinkedIn', 'url_template': 'https://www.linkedin.com/in/{username}/', 'category': 'Social'},
    {'name': 'GitHub', 'url_template': 'https://github.com/{username}', 'category': 'Coding'},
    {'name': 'GitLab', 'url_template': 'https://gitlab.com/{username}', 'category': 'Coding'},
    {'name': 'Bitbucket', 'url_template': 'https://bitbucket.org/{username}/', 'category': 'Coding'},
    {'name': 'LeetCode', 'url_template': 'https://leetcode.com/{username}/', 'category': 'Coding'},
    {'name': 'HackerRank', 'url_template': 'https://www.hackerrank.com/{username}', 'category': 'Coding'},
    {'name': 'Codeforces', 'url_template': 'https://codeforces.com/profile/{username}', 'category': 'Coding'},
    {'name': 'AtCoder', 'url_template': 'https://atcoder.jp/users/{username}', 'category': 'Coding'},
    {'name': 'Kaggle', 'url_template': 'https://www.kaggle.com/{username}', 'category': 'Coding'},
    {'name': 'GeeksforGeeks', 'url_template': 'https://www.geeksforgeeks.org/user/{username}/', 'category': 'Coding'},
    {'name': 'Stack Overflow', 'url_template': 'https://stackoverflow.com/users/{username}', 'category': 'Coding'},
    {'name': 'Hashnode', 'url_template': 'https://hashnode.com/@{username}', 'category': 'Coding'},
    {'name': 'Replit', 'url_template': 'https://replit.com/@{username}', 'category': 'Coding'},
    {'name': 'CodePen', 'url_template': 'https://codepen.io/{username}', 'category': 'Coding'},
    {'name': 'NPM', 'url_template': 'https://www.npmjs.com/~{username}', 'category': 'Coding'},
    {'name': 'PyPI', 'url_template': 'https://pypi.org/user/{username}/', 'category': 'Coding'},
    {'name': 'Docker Hub', 'url_template': 'https://hub.docker.com/u/{username}', 'category': 'Coding'},
    {'name': 'Vercel', 'url_template': 'https://vercel.com/{username}', 'category': 'Coding'},
    {'name': 'Netlify', 'url_template': 'https://app.netlify.com/teams/{username}', 'category': 'Coding'},
    {'name': 'AWS Community', 'url_template': 'https://community.aws/@{username}', 'category': 'Coding'},
    {'name': 'X (Twitter)', 'url_template': 'https://x.com/{username}', 'category': 'Social'},
    {'name': 'Instagram', 'url_template': 'https://www.instagram.com/{username}/', 'category': 'Social'},
    {'name': 'Facebook', 'url_template': 'https://www.facebook.com/{username}', 'category': 'Social'},
    {'name': 'Threads', 'url_template': 'https://www.threads.net/@{username}', 'category': 'Social'},
    {'name': 'TikTok', 'url_template': 'https://www.tiktok.com/@{username}', 'category': 'Social'},
    {'name': 'Reddit', 'url_template': 'https://www.reddit.com/user/{username}/', 'category': 'Social'},
    {'name': 'YouTube', 'url_template': 'https://www.youtube.com/@{username}', 'category': 'Social'},
    {'name': 'Twitch', 'url_template': 'https://www.twitch.tv/{username}', 'category': 'Social'},
    {'name': 'Discord', 'url_template': 'https://discord.com/users/{username}', 'category': 'Social'},
    {'name': 'Telegram', 'url_template': 'https://t.me/{username}', 'category': 'Social'},
    {'name': 'Medium', 'url_template': 'https://medium.com/@{username}', 'category': 'Social'},
    {'name': 'Substack', 'url_template': 'https://{username}.substack.com', 'category': 'Social'},
    {'name': 'Quora', 'url_template': 'https://www.quora.com/profile/{username}', 'category': 'Social'},
    {'name': 'Product Hunt', 'url_template': 'https://www.producthunt.com/@{username}', 'category': 'Social'},
    {'name': 'Perplexity', 'url_template': 'https://www.perplexity.ai/@{username}', 'category': 'Social'},
    {'name': 'ResearchGate', 'url_template': 'https://www.researchgate.net/profile/{username}', 'category': 'Academic'},
    {'name': 'Google Scholar', 'url_template': 'https://scholar.google.com/citations?user={username}', 'category': 'Academic'},
    {'name': 'IEEE Xplore', 'url_template': 'https://ieeexplore.ieee.org/search/searchresult.jsp?newsearch=true&queryText={username}', 'category': 'Academic'},
    {'name': 'ORCID', 'url_template': 'https://orcid.org/{username}', 'category': 'Academic'},
    {'name': 'Semantic Scholar', 'url_template': 'https://www.semanticscholar.org/search?q={username}', 'category': 'Academic'},
    {'name': 'arXiv', 'url_template': 'https://arxiv.org/search/?query={username}&searchtype=author', 'category': 'Academic'},
    {'name': 'Academia.edu', 'url_template': 'https://independent.academia.edu/{username}', 'category': 'Academic'},
    {'name': 'SlideShare', 'url_template': 'https://www.slideshare.net/{username}', 'category': 'Academic'},
    {'name': 'GitHub Pages', 'url_template': 'https://{username}.github.io', 'category': 'Blogs'},
    {'name': 'Personal .com Site', 'url_template': 'https://{username}.com', 'category': 'Blogs'},
    {'name': 'Personal .org Site', 'url_template': 'https://{username}.org', 'category': 'Blogs'},
]

NAME_SEARCH_PLATFORMS = [
    {'name': 'GitHub', 'query_url_template': 'https://github.com/search?q={query}&type=users', 'category': 'Coding'},
    {'name': 'LinkedIn', 'query_url_template': 'https://www.linkedin.com/search/results/people/?keywords={query}', 'category': 'Social'},
    {'name': 'Stack Overflow', 'query_url_template': 'https://stackoverflow.com/users?tab=Reputation&filter=all&search={query}', 'category': 'Coding'},
    {'name': 'X (Twitter)', 'query_url_template': 'https://x.com/search?q={query}&src=typed_query&f=user', 'category': 'Social'},
    {'name': 'Medium', 'query_url_template': 'https://medium.com/search/users?q={query}', 'category': 'Social'},
    {'name': 'ResearchGate', 'query_url_template': 'https://www.researchgate.net/search/publication?q={query}', 'category': 'Academic'},
    {'name': 'IEEE Xplore', 'query_url_template': 'https://ieeexplore.ieee.org/search/searchresult.jsp?newsearch=true&queryText={query}', 'category': 'Academic'},
]

RATE_LIMITS = {
    'default': (120, 60),
    '/auth/login': (25, 60),
    '/auth/signup': (10, 60),
    '/upload-face': (40, 60),
    '/scrape-aggregate': (20, 60),
}
RATE_BUCKETS: dict[str, deque[float]] = defaultdict(deque)
LOGIN_FAIL_TRACKER: dict[str, deque[float]] = defaultdict(deque)
LOGIN_LOCKED_UNTIL: dict[str, float] = {}
REDIS_URL = os.getenv('REDIS_URL', '').strip()
REDIS_RATE_PREFIX = os.getenv('REDIS_RATE_PREFIX', 'shadowgraph:ratelimit')
redis_client = redis_async.from_url(REDIS_URL, decode_responses=True) if (REDIS_URL and redis_async) else None
SCRAPE_JOBS: dict[str, dict[str, Any]] = {}
SCRAPE_SCHEDULES: dict[str, dict[str, Any]] = {}
scheduler = AsyncIOScheduler(timezone='UTC') if AsyncIOScheduler else None


class User(Base):
    __tablename__ = 'users'

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    email: Mapped[str] = mapped_column(String(255), unique=True, index=True, nullable=False)
    name: Mapped[str] = mapped_column(String(120), nullable=False)
    password_hash: Mapped[str] = mapped_column(String(255), nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))

    scans: Mapped[list['ScanEvent']] = relationship('ScanEvent', back_populates='user')
    settings: Mapped['UserSetting | None'] = relationship('UserSetting', back_populates='user', uselist=False)


class ScanEvent(Base):
    __tablename__ = 'scan_events'

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    user_id: Mapped[int] = mapped_column(ForeignKey('users.id'), index=True)
    scan_type: Mapped[str] = mapped_column(String(64), index=True)
    payload_json: Mapped[str] = mapped_column(Text, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))

    user: Mapped[User] = relationship('User', back_populates='scans')


class AuditEvent(Base):
    __tablename__ = 'audit_events'

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    user_id: Mapped[int | None] = mapped_column(Integer, index=True, nullable=True)
    event_type: Mapped[str] = mapped_column(String(80), index=True)
    details_json: Mapped[str] = mapped_column(Text, default='{}')
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))


class UserSetting(Base):
    __tablename__ = 'user_settings'

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    user_id: Mapped[int] = mapped_column(ForeignKey('users.id'), unique=True, index=True)
    profile_visible: Mapped[int] = mapped_column(Integer, default=1)
    allow_aggregation: Mapped[int] = mapped_column(Integer, default=1)
    breach_alerts: Mapped[int] = mapped_column(Integer, default=1)
    light_theme: Mapped[int] = mapped_column(Integer, default=0)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc)
    )

    user: Mapped[User] = relationship('User', back_populates='settings')


class SignupRequest(BaseModel):
    email: EmailStr
    password: str = Field(..., min_length=6, max_length=128)
    name: str | None = None

    @field_validator('password')
    @classmethod
    def validate_password_strength(cls, value: str) -> str:
        if len(value) < 8:
            raise ValueError('Password must be at least 8 characters long')
        if not re.search(r'[A-Z]', value):
            raise ValueError('Password must include at least one uppercase letter')
        if not re.search(r'[a-z]', value):
            raise ValueError('Password must include at least one lowercase letter')
        if not re.search(r'\d', value):
            raise ValueError('Password must include at least one digit')
        return value


class LoginRequest(BaseModel):
    email: EmailStr
    password: str = Field(..., min_length=6, max_length=128)


class AuthResponse(BaseModel):
    access_token: str
    token_type: str = 'bearer'
    user: dict[str, Any]


class OAuthExchangeRequest(BaseModel):
    code: str
    redirect_uri: str
    state: str


class UsernameRequest(BaseModel):
    username: str = Field(..., min_length=2, max_length=120)

    @field_validator('username')
    @classmethod
    def validate_username(cls, value: str) -> str:
        cleaned = re.sub(r'\s+', ' ', (value or '').strip())
        if len(cleaned) < 2:
            raise ValueError('Enter at least 2 characters')
        return cleaned


class ResearchRequest(BaseModel):
    full_name: str | None = None
    institution: str | None = None

    @field_validator('full_name', 'institution')
    @classmethod
    def normalize_text(cls, value: str | None) -> str:
        return (value or '').strip()

    @model_validator(mode='after')
    def validate_at_least_one_field(self) -> 'ResearchRequest':
        if not self.full_name and not self.institution:
            raise ValueError('Provide at least a full name or an institution')
        return self


class BreachRequest(BaseModel):
    email: EmailStr


class RiskRequest(BaseModel):
    public_profiles: int = Field(default=50, ge=0, le=100)
    research_visibility: int = Field(default=45, ge=0, le=100)
    breach_exposure: int = Field(default=30, ge=0, le=100)
    leak_indicators: int = Field(default=35, ge=0, le=100)


class SettingsUpdateRequest(BaseModel):
    profile_visible: bool
    allow_aggregation: bool
    breach_alerts: bool
    light_theme: bool


class ScrapeAggregateRequest(BaseModel):
    seed_urls: list[str] = Field(default_factory=list, max_length=8)
    keywords: list[str] = Field(default_factory=list, max_length=20)
    max_pages: int = Field(default=6, ge=1, le=20)
    same_domain_only: bool = True

    @field_validator('seed_urls')
    @classmethod
    def validate_seed_urls(cls, value: list[str]) -> list[str]:
        cleaned: list[str] = []
        for url in value:
            parsed = urlparse(url.strip())
            if parsed.scheme not in ('http', 'https') or not parsed.netloc:
                raise ValueError(f'Invalid URL: {url}')
            cleaned.append(url.strip())
        return cleaned


class ScrapeScheduleRequest(BaseModel):
    seed_urls: list[str] = Field(default_factory=list, max_length=8)
    keywords: list[str] = Field(default_factory=list, max_length=20)
    interval_minutes: int = Field(default=60, ge=5, le=1440)
    max_pages: int = Field(default=6, ge=1, le=20)
    same_domain_only: bool = True

    @field_validator('seed_urls')
    @classmethod
    def validate_seed_urls(cls, value: list[str]) -> list[str]:
        if not value:
            raise ValueError('Provide at least one seed URL')
        cleaned: list[str] = []
        for url in value:
            parsed = urlparse(url.strip())
            if parsed.scheme not in ('http', 'https') or not parsed.netloc:
                raise ValueError(f'Invalid URL: {url}')
            cleaned.append(url.strip())
        return cleaned


def get_db() -> Session:
    ensure_schema()
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def ensure_schema() -> None:
    global _schema_ready
    if _schema_ready:
        return
    with _schema_lock:
        if _schema_ready:
            return
        Base.metadata.create_all(bind=engine)
        _schema_ready = True


def hash_password(password: str) -> str:
    return pwd_context.hash(password)


def verify_password(password: str, password_hash: str) -> bool:
    return pwd_context.verify(password, password_hash)


def create_access_token(subject: str) -> str:
    expire = datetime.now(timezone.utc) + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    to_encode = {'sub': subject, 'exp': expire}
    return jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)


def serialize_user(user: User) -> dict[str, Any]:
    return {
        'id': user.id,
        'email': user.email,
        'name': user.name,
        'created_at': user.created_at.isoformat(),
    }


def create_oauth_state(provider: str, redirect_uri: str) -> str:
    payload = {
        'provider': provider,
        'redirect_uri': redirect_uri,
        'exp': datetime.now(timezone.utc) + timedelta(minutes=10),
    }
    return jwt.encode(payload, SECRET_KEY, algorithm=ALGORITHM)


def parse_oauth_state(state_token: str) -> dict[str, Any]:
    try:
        payload = jwt.decode(state_token, SECRET_KEY, algorithms=[ALGORITHM])
        return payload
    except JWTError as exc:
        raise HTTPException(status_code=400, detail='Invalid OAuth state') from exc


def _oauth_config(provider: str) -> dict[str, str]:
    provider = provider.lower()
    if provider == 'google':
        return {
            'client_id': os.getenv('GOOGLE_CLIENT_ID', ''),
            'client_secret': os.getenv('GOOGLE_CLIENT_SECRET', ''),
            'auth_url': 'https://accounts.google.com/o/oauth2/v2/auth',
            'token_url': 'https://oauth2.googleapis.com/token',
            'scope': 'openid email profile',
        }
    if provider == 'github':
        return {
            'client_id': os.getenv('GITHUB_CLIENT_ID', ''),
            'client_secret': os.getenv('GITHUB_CLIENT_SECRET', ''),
            'auth_url': 'https://github.com/login/oauth/authorize',
            'token_url': 'https://github.com/login/oauth/access_token',
            'scope': 'read:user user:email',
        }
    raise HTTPException(status_code=404, detail='Unsupported OAuth provider')


def _upsert_oauth_user(db: Session, email: str, name: str) -> User:
    user = db.query(User).filter(User.email == email.lower()).first()
    if user:
        if name and user.name != name:
            user.name = name
            db.commit()
            db.refresh(user)
        return user

    random_password = os.urandom(16).hex()
    user = User(
        email=email.lower(),
        name=name or email.split('@')[0],
        password_hash=hash_password(random_password),
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


def require_user(db: Session, token: str) -> User:
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail='Could not validate credentials',
        headers={'WWW-Authenticate': 'Bearer'},
    )

    payload = None
    for key in VERIFY_KEYS:
        try:
            payload = jwt.decode(token, key, algorithms=[ALGORITHM])
            break
        except JWTError:
            continue
    if not payload:
        raise credentials_exception
    try:
        sub = payload.get('sub')
        if sub is None:
            raise credentials_exception
        user_id = int(sub)
    except ValueError:
        raise credentials_exception

    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise credentials_exception
    return user


def get_current_user(token: str = Depends(oauth2_scheme), db: Session = Depends(get_db)) -> User:
    return require_user(db, token)


def store_scan_event(db: Session, user: User, scan_type: str, payload: dict[str, Any]) -> None:
    event = ScanEvent(user_id=user.id, scan_type=scan_type, payload_json=json.dumps(payload))
    db.add(event)
    db.commit()


def store_audit_event(db: Session, event_type: str, user_id: int | None, details: dict[str, Any]) -> None:
    record = AuditEvent(user_id=user_id, event_type=event_type, details_json=json.dumps(details))
    db.add(record)
    db.commit()


def _prune_login_tracker(email: str, now: float) -> None:
    bucket = LOGIN_FAIL_TRACKER[email]
    while bucket and (now - bucket[0] > LOGIN_LOCK_WINDOW_SECONDS):
        bucket.popleft()


def _register_login_failure(email: str) -> None:
    now = time.time()
    _prune_login_tracker(email, now)
    bucket = LOGIN_FAIL_TRACKER[email]
    bucket.append(now)
    if len(bucket) >= LOGIN_MAX_FAILURES:
        LOGIN_LOCKED_UNTIL[email] = now + LOGIN_LOCK_WINDOW_SECONDS


def _clear_login_failures(email: str) -> None:
    LOGIN_FAIL_TRACKER.pop(email, None)
    LOGIN_LOCKED_UNTIL.pop(email, None)


def _client_key(request: Request) -> str:
    if request.headers.get('authorization'):
        return request.headers.get('authorization', '')
    return request.client.host if request.client else 'unknown'


def _rate_config(path: str) -> tuple[int, int]:
    return RATE_LIMITS.get(path, RATE_LIMITS['default'])


@app.middleware('http')
async def security_headers_middleware(request: Request, call_next):
    started = time.perf_counter()
    response = await call_next(request)
    response.headers['X-Content-Type-Options'] = 'nosniff'
    response.headers['X-Frame-Options'] = 'DENY'
    response.headers['Referrer-Policy'] = 'strict-origin-when-cross-origin'
    response.headers['Content-Security-Policy'] = "default-src 'self'; img-src 'self' data: blob:; style-src 'self' 'unsafe-inline'; script-src 'self'"
    response.headers['X-Request-Id'] = request.headers.get('x-request-id', str(uuid.uuid4()))
    response.headers['X-Response-Time-Ms'] = str(int((time.perf_counter() - started) * 1000))
    logger.info('%s %s %s', request.method, request.url.path, response.status_code)
    return response


@app.middleware('http')
async def rate_limit_middleware(request: Request, call_next):
    limit, window_seconds = _rate_config(request.url.path)
    key = f"{request.url.path}:{_client_key(request)}"
    now = time.time()
    if redis_client is not None:
        redis_key = f'{REDIS_RATE_PREFIX}:{key}'
        try:
            current = await redis_client.incr(redis_key)
            if current == 1:
                await redis_client.expire(redis_key, window_seconds)
            if int(current) > limit:
                return JSONResponse(status_code=429, content={'detail': 'Rate limit exceeded'})
        except Exception:
            bucket = RATE_BUCKETS[key]
            while bucket and (now - bucket[0] > window_seconds):
                bucket.popleft()
            if len(bucket) >= limit:
                return JSONResponse(status_code=429, content={'detail': 'Rate limit exceeded'})
            bucket.append(now)
    else:
        bucket = RATE_BUCKETS[key]
        while bucket and (now - bucket[0] > window_seconds):
            bucket.popleft()
        if len(bucket) >= limit:
            return JSONResponse(status_code=429, content={'detail': 'Rate limit exceeded'})
        bucket.append(now)
    return await call_next(request)


def _ensure_user_settings(db: Session, user: User) -> UserSetting:
    settings = db.query(UserSetting).filter(UserSetting.user_id == user.id).first()
    if settings:
        return settings
    settings = UserSetting(user_id=user.id)
    db.add(settings)
    db.commit()
    db.refresh(settings)
    return settings


@app.on_event('startup')
def startup() -> None:
    # Ensure local SQLite schema exists for first-run and after db cleanup.
    ensure_schema()
    FACE_GALLERY_DIR.mkdir(parents=True, exist_ok=True)
    if not FACE_GALLERY_META.exists():
        FACE_GALLERY_META.write_text('[]\n', encoding='utf-8')
    if SECRET_KEY == 'change-this-in-production-shadowgraph':
        logger.warning('Using default SECRET_KEY. Set SHADOWGRAPH_SECRET_KEY or SHADOWGRAPH_JWT_KEYS.')
    if scheduler:
        scheduler.start()


@app.get('/health')
def health() -> dict[str, Any]:
    return {'ok': True, 'service': 'shadowgraph-backend'}


@app.get('/ops/readiness')
def ops_readiness() -> dict[str, Any]:
    checks = {
        'secret_key_configured': SECRET_KEY != 'change-this-in-production-shadowgraph',
        'redis_configured': bool(REDIS_URL),
        'hibp_configured': bool(os.getenv('HIBP_API_KEY', '').strip()),
        'google_oauth_configured': bool(os.getenv('GOOGLE_CLIENT_ID', '').strip() and os.getenv('GOOGLE_CLIENT_SECRET', '').strip()),
        'github_oauth_configured': bool(os.getenv('GITHUB_CLIENT_ID', '').strip() and os.getenv('GITHUB_CLIENT_SECRET', '').strip()),
        'deepface_available': DeepFace is not None,
        'face_gallery_exists': FACE_GALLERY_META.exists(),
    }
    missing = [k for k, v in checks.items() if not v]
    return {'checks': checks, 'missing': missing, 'ready': len(missing) == 0}


@app.post('/auth/signup', response_model=AuthResponse)
def auth_signup(payload: SignupRequest, db: Session = Depends(get_db)) -> dict[str, Any]:
    existing = db.query(User).filter(User.email == payload.email.lower()).first()
    if existing:
        raise HTTPException(status_code=409, detail='Email already registered')

    resolved_name = (payload.name or payload.email.split('@')[0]).strip() or payload.email.split('@')[0]
    user = User(
        email=payload.email.lower(),
        name=resolved_name,
        password_hash=hash_password(payload.password),
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    _ensure_user_settings(db, user)
    store_audit_event(db, 'auth.signup', user.id, {'email': user.email})

    token = create_access_token(str(user.id))
    return {'access_token': token, 'token_type': 'bearer', 'user': serialize_user(user)}


@app.post('/auth/login', response_model=AuthResponse)
def auth_login(payload: LoginRequest, db: Session = Depends(get_db)) -> dict[str, Any]:
    email = payload.email.lower()
    now = time.time()
    locked_until = LOGIN_LOCKED_UNTIL.get(email, 0)
    if locked_until > now:
        remaining = int(locked_until - now)
        raise HTTPException(status_code=429, detail=f'Too many failed attempts. Try again in {remaining} seconds.')

    user = db.query(User).filter(User.email == email).first()
    if not user or not verify_password(payload.password, user.password_hash):
        _register_login_failure(email)
        store_audit_event(db, 'auth.login_failed', user.id if user else None, {'email': email})
        raise HTTPException(status_code=401, detail='Invalid email or password')

    _clear_login_failures(email)
    store_audit_event(db, 'auth.login_success', user.id, {'email': user.email})
    token = create_access_token(str(user.id))
    return {'access_token': token, 'token_type': 'bearer', 'user': serialize_user(user)}


@app.get('/auth/oauth/{provider}/start-url')
def auth_oauth_start_url(provider: str, redirect_uri: str) -> dict[str, Any]:
    config = _oauth_config(provider)
    if not config['client_id']:
        raise HTTPException(status_code=503, detail=f'{provider} OAuth is not configured on backend')

    state = create_oauth_state(provider.lower(), redirect_uri)
    query = {
        'client_id': config['client_id'],
        'redirect_uri': redirect_uri,
        'response_type': 'code',
        'scope': config['scope'],
        'state': state,
    }

    if provider.lower() == 'google':
        query['access_type'] = 'online'
        query['prompt'] = 'consent'

    return {'auth_url': f"{config['auth_url']}?{urlencode(query)}", 'state': state}


@app.post('/auth/oauth/{provider}/exchange', response_model=AuthResponse)
async def auth_oauth_exchange(provider: str, payload: OAuthExchangeRequest, db: Session = Depends(get_db)) -> dict[str, Any]:
    config = _oauth_config(provider)
    if not config['client_id'] or not config['client_secret']:
        raise HTTPException(status_code=503, detail=f'{provider} OAuth is not configured on backend')

    state_payload = parse_oauth_state(payload.state)
    if state_payload.get('provider') != provider.lower():
        raise HTTPException(status_code=400, detail='OAuth state/provider mismatch')
    if state_payload.get('redirect_uri') != payload.redirect_uri:
        raise HTTPException(status_code=400, detail='OAuth redirect URI mismatch')

    async with httpx.AsyncClient(timeout=15) as client:
        if provider.lower() == 'google':
            token_resp = await client.post(
                config['token_url'],
                data={
                    'code': payload.code,
                    'client_id': config['client_id'],
                    'client_secret': config['client_secret'],
                    'redirect_uri': payload.redirect_uri,
                    'grant_type': 'authorization_code',
                },
            )
            if token_resp.status_code >= 400:
                raise HTTPException(status_code=400, detail='Failed to exchange Google OAuth code')
            access_token = token_resp.json().get('access_token')
            if not access_token:
                raise HTTPException(status_code=400, detail='Google OAuth token missing')

            user_resp = await client.get(
                'https://www.googleapis.com/oauth2/v3/userinfo',
                headers={'Authorization': f'Bearer {access_token}'},
            )
            if user_resp.status_code >= 400:
                raise HTTPException(status_code=400, detail='Failed to fetch Google user profile')
            user_data = user_resp.json()
            email = user_data.get('email')
            name = user_data.get('name') or (email.split('@')[0] if email else 'Google User')
        else:
            token_resp = await client.post(
                config['token_url'],
                headers={'Accept': 'application/json'},
                data={
                    'code': payload.code,
                    'client_id': config['client_id'],
                    'client_secret': config['client_secret'],
                    'redirect_uri': payload.redirect_uri,
                },
            )
            if token_resp.status_code >= 400:
                raise HTTPException(status_code=400, detail='Failed to exchange GitHub OAuth code')
            access_token = token_resp.json().get('access_token')
            if not access_token:
                raise HTTPException(status_code=400, detail='GitHub OAuth token missing')

            user_resp = await client.get(
                'https://api.github.com/user',
                headers={'Authorization': f'Bearer {access_token}', 'Accept': 'application/json'},
            )
            if user_resp.status_code >= 400:
                raise HTTPException(status_code=400, detail='Failed to fetch GitHub user profile')
            user_data = user_resp.json()

            email = user_data.get('email')
            if not email:
                emails_resp = await client.get(
                    'https://api.github.com/user/emails',
                    headers={'Authorization': f'Bearer {access_token}', 'Accept': 'application/json'},
                )
                if emails_resp.status_code < 400:
                    emails = emails_resp.json() or []
                    primary = next((row for row in emails if row.get('primary')), None)
                    verified = next((row for row in emails if row.get('verified')), None)
                    best = primary or verified or (emails[0] if emails else {})
                    email = best.get('email')
            name = user_data.get('name') or user_data.get('login') or (email.split('@')[0] if email else 'GitHub User')

    if not email:
        raise HTTPException(status_code=400, detail='OAuth provider did not return an email address')

    user = _upsert_oauth_user(db, email=email, name=name)
    token = create_access_token(str(user.id))
    return {'access_token': token, 'token_type': 'bearer', 'user': serialize_user(user)}


@app.get('/auth/me')
def auth_me(current_user: User = Depends(get_current_user)) -> dict[str, Any]:
    return {'user': serialize_user(current_user)}


def _serialize_settings(settings: UserSetting) -> dict[str, Any]:
    return {
        'profile_visible': bool(settings.profile_visible),
        'allow_aggregation': bool(settings.allow_aggregation),
        'breach_alerts': bool(settings.breach_alerts),
        'light_theme': bool(settings.light_theme),
        'updated_at': settings.updated_at.isoformat() if settings.updated_at else None,
    }


@app.get('/settings')
def get_settings(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)) -> dict[str, Any]:
    settings = _ensure_user_settings(db, current_user)
    return {'settings': _serialize_settings(settings)}


@app.put('/settings')
def update_settings(
    payload: SettingsUpdateRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> dict[str, Any]:
    settings = _ensure_user_settings(db, current_user)
    settings.profile_visible = 1 if payload.profile_visible else 0
    settings.allow_aggregation = 1 if payload.allow_aggregation else 0
    settings.breach_alerts = 1 if payload.breach_alerts else 0
    settings.light_theme = 1 if payload.light_theme else 0
    db.commit()
    db.refresh(settings)
    store_audit_event(db, 'settings.updated', current_user.id, _serialize_settings(settings))
    return {'settings': _serialize_settings(settings)}


@app.delete('/account')
def delete_account(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)) -> dict[str, Any]:
    store_audit_event(db, 'account.delete_requested', current_user.id, {'email': current_user.email})
    db.query(ScanEvent).filter(ScanEvent.user_id == current_user.id).delete()
    db.query(UserSetting).filter(UserSetting.user_id == current_user.id).delete()
    db.query(AuditEvent).filter(AuditEvent.user_id == current_user.id).delete()
    db.query(User).filter(User.id == current_user.id).delete()
    db.commit()
    return {'status': 'deleted'}


def _decode_image(image_bytes: bytes) -> np.ndarray:
    arr = np.frombuffer(image_bytes, dtype=np.uint8)
    image = cv2.imdecode(arr, cv2.IMREAD_COLOR)
    if image is None:
        raise HTTPException(status_code=400, detail='Invalid image data.')
    return image


def _detect_faces_cv(image: np.ndarray) -> list[tuple[int, int, int, int]]:
    gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
    faces = FACE_DETECTOR.detectMultiScale(gray, scaleFactor=1.1, minNeighbors=5, minSize=(48, 48))
    return [tuple(map(int, face)) for face in faces]


def _load_query_face_encodings(image_bytes: bytes) -> list[np.ndarray]:
    if face_recognition is None:
        return []
    array = face_recognition.load_image_file(io.BytesIO(image_bytes))
    locations = face_recognition.face_locations(array, model='hog')
    if not locations:
        return []
    return face_recognition.face_encodings(array, known_face_locations=locations)


def _load_gallery_items() -> list[dict[str, Any]]:
    if face_recognition is None:
        return []
    if not FACE_GALLERY_META.exists():
        return []

    try:
        entries = json.loads(FACE_GALLERY_META.read_text(encoding='utf-8'))
    except (OSError, json.JSONDecodeError):
        return []

    items: list[dict[str, Any]] = []
    for entry in entries:
        image_name = entry.get('image')
        if not image_name:
            continue

        image_path = FACE_GALLERY_DIR / image_name
        if not image_path.exists():
            continue

        try:
            known_image = face_recognition.load_image_file(str(image_path))
            known_encodings = face_recognition.face_encodings(known_image)
        except Exception:
            continue

        if not known_encodings:
            continue

        items.append(
            {
                'platform': entry.get('platform', 'Unknown'),
                'profile_url': entry.get('profile_url', ''),
                'name': entry.get('name', 'Unknown'),
                'encoding': known_encodings[0],
            }
        )

    return items


def _confidence_from_distance(distance: float) -> int:
    # face_recognition best-match threshold is typically around 0.6
    score = max(0.0, min(1.0, (0.62 - distance) / 0.62))
    return int(round(score * 100))


def _match_profiles(query_encodings: list[np.ndarray], threshold: float = 0.6) -> list[dict[str, Any]]:
    gallery_items = _load_gallery_items()
    if not gallery_items or not query_encodings:
        return []

    matches: list[dict[str, Any]] = []
    query = query_encodings[0]

    for item in gallery_items:
        distance = float(np.linalg.norm(query - item['encoding']))
        if distance > threshold:
            continue

        matches.append(
            {
                'platform': item['platform'],
                'name': item['name'],
                'profile_url': item['profile_url'],
                'confidence': _confidence_from_distance(distance),
                'distance': round(distance, 4),
            }
        )

    matches.sort(key=lambda row: row['confidence'], reverse=True)
    return matches[:6]


def _clamp01(value: float) -> float:
    return max(0.0, min(1.0, value))


def _anti_spoof_heuristic(image: np.ndarray, face_box: tuple[int, int, int, int]) -> dict[str, Any]:
    x, y, w, h = face_box
    face = image[y:y + h, x:x + w]
    gray = cv2.cvtColor(face, cv2.COLOR_BGR2GRAY)

    blur_var = float(cv2.Laplacian(gray, cv2.CV_64F).var())
    brightness = float(gray.mean())
    edges = cv2.Canny(gray, 60, 140)
    edge_ratio = float(edges.mean() / 255.0)
    face_ratio = float((w * h) / (image.shape[0] * image.shape[1]))

    blur_risk = _clamp01((90.0 - blur_var) / 90.0)
    brightness_risk = _clamp01(abs(brightness - 120.0) / 120.0)
    edge_risk = _clamp01(abs(edge_ratio - 0.12) / 0.12)
    size_risk = _clamp01((0.03 - face_ratio) / 0.03)

    fake_score = int(round((0.40 * blur_risk + 0.20 * brightness_risk + 0.25 * edge_risk + 0.15 * size_risk) * 100))
    label = 'Likely Synthetic' if fake_score >= 65 else 'Likely Real'
    return {
        'fake_score': fake_score,
        'label': label,
        'model': 'heuristic-fallback',
        'signals': {
            'blur_variance': round(blur_var, 2),
            'brightness_mean': round(brightness, 2),
            'edge_ratio': round(edge_ratio, 4),
            'face_area_ratio': round(face_ratio, 4),
        },
    }


def _anti_spoof_deep(image: np.ndarray) -> dict[str, Any] | None:
    if DeepFace is None:
        return None

    try:
        rgb = cv2.cvtColor(image, cv2.COLOR_BGR2RGB)
        faces = DeepFace.extract_faces(
            img_path=rgb,
            detector_backend='retinaface',
            enforce_detection=False,
            anti_spoofing=True,
        )
    except Exception:
        return None

    if not faces:
        return None

    best = max(faces, key=lambda f: float(f.get('confidence', 0.0)))
    is_real = bool(best.get('is_real', False))
    anti_score = float(best.get('antispoof_score', 0.0))

    # DeepFace anti_spoof score leans toward "real" confidence.
    fake_score = int(round((1.0 - _clamp01(anti_score)) * 100))
    if not is_real:
        fake_score = max(fake_score, 70)

    label = 'Likely Synthetic' if fake_score >= 50 else 'Likely Real'
    return {
        'fake_score': fake_score,
        'label': label,
        'model': 'deepface-antispoof',
        'signals': {
            'anti_spoof_real_confidence': round(anti_score, 4),
            'is_real': is_real,
        },
    }


def _absolute_media_url(base_url: str, media_url: str) -> str:
    if not media_url:
        return ''
    parsed = urlparse(media_url)
    if parsed.scheme in ('http', 'https'):
        return media_url
    return urljoin(base_url, media_url)


def _extract_profile_preview(url: str, html: str) -> dict[str, str]:
    soup = BeautifulSoup(html, 'html.parser')
    title = _normalize_text(soup.title.string if soup.title and soup.title.string else 'Profile')
    image = ''
    og = soup.find('meta', attrs={'property': 'og:image'})
    if og and og.get('content'):
        image = og.get('content', '').strip()
    if not image:
        tw = soup.find('meta', attrs={'name': 'twitter:image'})
        if tw and tw.get('content'):
            image = tw.get('content', '').strip()
    return {'title': title[:180], 'image_url': _absolute_media_url(url, image)}


def _face_match_confidence(query_encodings: list[np.ndarray], candidate_image_bytes: bytes) -> int | None:
    if face_recognition is None or not query_encodings:
        return None
    try:
        image = face_recognition.load_image_file(io.BytesIO(candidate_image_bytes))
        locations = face_recognition.face_locations(image, model='hog')
        if not locations:
            return None
        candidate_encodings = face_recognition.face_encodings(image, known_face_locations=locations)
        if not candidate_encodings:
            return None
        distance = float(np.linalg.norm(query_encodings[0] - candidate_encodings[0]))
        return _confidence_from_distance(distance)
    except Exception:
        return None


async def _build_online_presence(query_encodings: list[np.ndarray], search_hint: str) -> list[dict[str, Any]]:
    variants = _username_variants(search_hint)[:8]
    if not variants:
        return []

    matches: list[dict[str, Any]] = []
    async with httpx.AsyncClient(
        timeout=10,
        follow_redirects=True,
        headers={'User-Agent': 'Mozilla/5.0 (compatible; ShadowGraphPresence/1.0; +https://shadowgraph.local)'},
    ) as client:
        for platform in PLATFORMS:
            best: dict[str, Any] | None = None
            for variant in variants:
                url = platform['url_template'].format(username=variant)
                try:
                    resp = await client.get(url)
                except httpx.HTTPError:
                    continue
                if resp.status_code >= 400 or _looks_unreachable_profile(resp):
                    continue
                preview = _extract_profile_preview(url, resp.text)
                face_confidence = None
                if preview.get('image_url'):
                    try:
                        image_resp = await client.get(preview['image_url'])
                        if image_resp.status_code < 400 and image_resp.content:
                            face_confidence = _face_match_confidence(query_encodings, image_resp.content)
                    except httpx.HTTPError:
                        face_confidence = None

                row = {
                    'platform': platform['name'],
                    'category': platform.get('category', 'General'),
                    'username': variant,
                    'profile_url': url,
                    'title': preview.get('title', 'Profile'),
                    'image_preview': preview.get('image_url', ''),
                    'face_match_confidence': face_confidence,
                    'status': 'Found',
                }
                if not best:
                    best = row
                else:
                    prev = best.get('face_match_confidence')
                    cur = row.get('face_match_confidence')
                    if (cur or -1) > (prev or -1):
                        best = row
            if best:
                matches.append(best)
    return matches


@app.post('/upload-face')
async def upload_face(
    file: UploadFile = File(...),
    search_text: str | None = Form(default=None),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> dict[str, Any]:
    if not file.content_type or not file.content_type.startswith('image/'):
        raise HTTPException(status_code=400, detail='Only image uploads are supported.')

    image_bytes = await file.read()
    if not image_bytes:
        raise HTTPException(status_code=400, detail='Uploaded file is empty.')
    if len(image_bytes) > 8 * 1024 * 1024:
        raise HTTPException(status_code=413, detail='Image exceeds 8MB size limit.')

    image = _decode_image(image_bytes)
    cv_faces = _detect_faces_cv(image)
    query_encodings = _load_query_face_encodings(image_bytes)

    if not cv_faces and not query_encodings:
        payload = {
            'matched_profiles': [],
            'faces_detected': 0,
            'fake_detection_confidence': 100,
            'fake_detection_label': 'No Face Detected',
            'signals': {},
            'status': 'processed',
        }
        store_scan_event(db, current_user, 'face_scan', payload)
        return payload

    matched_profiles = _match_profiles(query_encodings)

    deep_fake = _anti_spoof_deep(image)
    if deep_fake:
        fake = deep_fake
    else:
        primary_face = max(cv_faces, key=lambda face: face[2] * face[3]) if cv_faces else (0, 0, image.shape[1], image.shape[0])
        fake = _anti_spoof_heuristic(image, primary_face)

    search_hint = (search_text or '').strip()
    online_presence = await _build_online_presence(query_encodings, search_hint) if search_hint else []
    query_owner = 'self'
    if search_hint:
        query_owner = 'self' if _is_self_query_value(search_hint, current_user) else 'external'

    payload = {
        'matched_profiles': matched_profiles,
        'online_presence': online_presence,
        'search_text': search_hint,
        'query_owner': query_owner,
        'faces_detected': max(len(cv_faces), len(query_encodings)),
        'fake_detection_confidence': fake['fake_score'],
        'fake_detection_label': fake['label'],
        'signals': fake['signals'],
        'anti_spoof_model': fake['model'],
        'presence_summary': {
            'profiles_found': len(online_presence),
            'platforms_checked': len(PLATFORMS),
        },
        'status': 'processed',
        'source_policy': 'Public profile pages only. Results depend on public availability and site access rules.',
    }
    store_scan_event(db, current_user, 'face_scan', payload)
    return payload


async def _probe_platform(client: httpx.AsyncClient, platform: dict[str, str], username: str) -> dict[str, Any]:
    url = platform['url_template'].format(username=username)
    started = time.perf_counter()

    try:
        response = await client.get(url)
        elapsed_ms = int((time.perf_counter() - started) * 1000)

        if response.status_code in (200, 301, 302) and not _looks_unreachable_profile(response):
            status_name = 'Found'
        elif response.status_code == 404:
            status_name = 'Not Found'
        elif response.status_code == 429:
            status_name = 'Rate Limited'
        else:
            status_name = 'Unknown'

        return {
            'platform': platform['name'],
            'username': username,
            'status': status_name,
            'profile_url': url,
            'http_status': response.status_code,
            'response_ms': elapsed_ms,
        }
    except httpx.TimeoutException:
        return {
            'platform': platform['name'],
            'username': username,
            'status': 'Unknown',
            'profile_url': url,
            'http_status': 0,
            'response_ms': -1,
            'error': 'timeout',
        }
    except httpx.HTTPError:
        return {
            'platform': platform['name'],
            'username': username,
            'status': 'Unknown',
            'profile_url': url,
            'http_status': 0,
            'response_ms': -1,
            'error': 'network_error',
        }
    except Exception:
        return {
            'platform': platform['name'],
            'username': username,
            'status': 'Unknown',
            'profile_url': url,
            'http_status': 0,
            'response_ms': -1,
            'error': 'network_error',
        }


async def _probe_name_search_links(client: httpx.AsyncClient, raw_name: str) -> list[dict[str, Any]]:
    query = quote_plus(raw_name.strip())
    if not query:
        return []
    rows: list[dict[str, Any]] = []
    for platform in NAME_SEARCH_PLATFORMS:
        url = platform['query_url_template'].format(query=query)
        started = time.perf_counter()
        try:
            response = await client.get(url)
            elapsed_ms = int((time.perf_counter() - started) * 1000)
            if response.status_code >= 400:
                continue
            rows.append(
                {
                    'platform': platform['name'],
                    'username': raw_name.strip(),
                    'status': 'Found',
                    'profile_url': url,
                    'http_status': response.status_code,
                    'response_ms': elapsed_ms,
                    'match_type': 'name_search',
                }
            )
        except httpx.HTTPError:
            continue
        except Exception:
            continue
    return rows


def _username_variants(raw_username: str) -> list[str]:
    normalized = re.sub(r'\s+', ' ', raw_username.strip().lower())
    if not normalized:
        return []

    parts = [re.sub(r'[^a-z0-9._-]', '', p) for p in normalized.split(' ') if p]
    parts = [p for p in parts if p]
    if not parts:
        return []

    variants: list[str] = []
    joined = ''.join(parts)
    if joined:
        variants.append(joined)

    if len(parts) >= 2:
        variants.extend(
            [
                '.'.join(parts),
                '_'.join(parts),
                '-'.join(parts),
                ''.join(reversed(parts)),
                '.'.join(reversed(parts)),
                '_'.join(reversed(parts)),
                '-'.join(reversed(parts)),
            ]
        )

    # Keep already username-like raw input too.
    raw_compact = re.sub(r'[^a-z0-9._-]', '', normalized)
    if raw_compact:
        variants.append(raw_compact)

    unique: list[str] = []
    seen: set[str] = set()
    for variant in variants:
        if not variant:
            continue
        if len(variant) < 2 or len(variant) > 40:
            continue
        if not USERNAME_REGEX.fullmatch(variant):
            continue
        if variant in seen:
            continue
        seen.add(variant)
        unique.append(variant)
    return unique[:12]


@app.post('/scan-username')
async def scan_username(
    payload: UsernameRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> dict[str, Any]:
    started = time.perf_counter()
    query_owner = 'self' if _is_self_query_value(payload.username, current_user) else 'external'
    raw_query = (payload.username or '').strip()

    try:
        variants = _username_variants(payload.username)
        name_search_rows: list[dict[str, Any]] = []
        found_results: list[dict[str, Any]] = []

        async with httpx.AsyncClient(
            timeout=8,
            follow_redirects=True,
            headers={
                'User-Agent': 'Mozilla/5.0 (compatible; ShadowGraph/0.3; +https://shadowgraph.local)'
            },
        ) as client:
            if variants:
                probes = [
                    _probe_platform(client, platform, variant)
                    for platform in PLATFORMS
                    for variant in variants
                ]
                probed = await asyncio.gather(*probes)

                # Pick best candidate per platform: Found > Not Found > Unknown, then lower latency.
                score = {'Found': 3, 'Not Found': 2, 'Rate Limited': 1, 'Unknown': 0}
                grouped: dict[str, list[dict[str, Any]]] = defaultdict(list)
                for row in probed:
                    grouped[row['platform']].append(row)

                results: list[dict[str, Any]] = []
                for platform in PLATFORMS:
                    candidates = grouped.get(platform['name'], [])
                    if not candidates:
                        continue
                    candidates.sort(key=lambda r: (score.get(r['status'], 0), -(r['response_ms'] if r['response_ms'] >= 0 else 999999)), reverse=True)
                    best = candidates[0]
                    results.append(best)

                found_results = [
                    row
                    for row in results
                    if row.get('status') == 'Found'
                    and isinstance(row.get('profile_url'), str)
                    and row.get('profile_url', '').startswith(('http://', 'https://'))
                ]

            # Full-name or invalid-variant inputs still get stable public search links.
            if ' ' in raw_query or not variants:
                name_search_rows = await _probe_name_search_links(client, payload.username)

        if name_search_rows:
            seen_links = {row['profile_url'] for row in found_results if row.get('profile_url')}
            for row in name_search_rows:
                if row['profile_url'] in seen_links:
                    continue
                found_results.append(row)
                seen_links.add(row['profile_url'])

        duration_ms = int((time.perf_counter() - started) * 1000)
        response_payload = {
            'username': payload.username,
            'query_owner': query_owner,
            'username_variants_checked': variants,
            'results': found_results,
            'summary': {
                'total_platforms': len(PLATFORMS),
                'found': len(found_results),
                'duration_ms': duration_ms,
            },
            'status': 'live-scan',
            'source_policy': 'Public profile URLs only. No private or gated data is accessed.',
        }
        store_scan_event(db, current_user, 'username_scan', response_payload)
        return response_payload
    except Exception as exc:
        logger.warning('username scan fallback due to unexpected error: %s', exc)
        fallback_results = [
            {
                'platform': row['name'],
                'username': raw_query or payload.username,
                'status': 'Found',
                'profile_url': row['query_url_template'].format(query=quote_plus(raw_query or payload.username)),
                'http_status': 200,
                'response_ms': -1,
                'match_type': 'fallback_search',
            }
            for row in NAME_SEARCH_PLATFORMS
        ]
        response_payload = {
            'username': payload.username,
            'query_owner': query_owner,
            'username_variants_checked': _username_variants(payload.username),
            'results': fallback_results,
            'summary': {
                'total_platforms': len(NAME_SEARCH_PLATFORMS),
                'found': len(fallback_results),
                'duration_ms': int((time.perf_counter() - started) * 1000),
            },
            'status': 'fallback-search',
            'source_policy': 'Public search URLs only. No private or gated data is accessed.',
        }
        store_scan_event(db, current_user, 'username_scan', response_payload)
        return response_payload


def _author_names(authors: list[dict[str, Any]]) -> str:
    names: list[str] = []
    for author in authors[:5]:
        given = author.get('given', '').strip()
        family = author.get('family', '').strip()
        full_name = f'{given} {family}'.strip()
        if full_name:
            names.append(full_name)
    return ', '.join(names) if names else 'Unknown'


def _name_variants(full_name: str) -> list[str]:
    normalized = re.sub(r'\s+', ' ', (full_name or '').strip())
    if not normalized:
        return []

    parts = [part for part in normalized.split(' ') if part]
    variants: list[str] = [normalized]

    if len(parts) >= 2:
        reversed_name = ' '.join(reversed(parts))
        variants.append(reversed_name)

        family = parts[-1]
        given = ' '.join(parts[:-1])
        variants.append(f'{family}, {given}')

    # de-duplicate while preserving order
    seen: set[str] = set()
    unique: list[str] = []
    for variant in variants:
        key = variant.lower()
        if key not in seen:
            seen.add(key)
            unique.append(variant)
    return unique


def _tokenize_name(value: str) -> list[str]:
    cleaned = re.sub(r'[^a-z\s]', ' ', (value or '').lower())
    return [part for part in cleaned.split() if part]


def _user_identity_markers(user: User) -> dict[str, Any]:
    email_local = (user.email or '').split('@')[0].lower()
    full_name = (user.name or '').strip().lower()
    reversed_name = ' '.join(reversed(full_name.split()))

    def _norm(value: str) -> str:
        return re.sub(r'[^a-z0-9]', '', value or '')

    full_norm = _norm(full_name)
    email_norm = _norm(email_local)
    reversed_norm = _norm(reversed_name)
    name_tokens = [re.sub(r'[^a-z0-9]', '', token.lower()) for token in full_name.split() if token.strip()]
    name_tokens = [token for token in name_tokens if token]
    return {
        'exact_set': {value for value in (full_norm, email_norm, reversed_norm) if value},
        'name_tokens': name_tokens,
    }


def _is_self_query_value(value: str, user: User) -> bool:
    q_norm = re.sub(r'[^a-z0-9]', '', (value or '').strip().lower())
    if not q_norm:
        return False
    markers = _user_identity_markers(user)
    if q_norm in markers['exact_set']:
        return True

    query_tokens = set(_tokenize_name(value))
    reference_tokens = set(_tokenize_name(f"{user.name} {(user.email or '').split('@')[0]}"))
    return len(query_tokens & reference_tokens) >= 2


def _is_self_profile_username(username: str, user: User) -> bool:
    u_norm = re.sub(r'[^a-z0-9]', '', (username or '').strip().lower())
    if not u_norm:
        return False
    markers = _user_identity_markers(user)
    if u_norm in markers['exact_set']:
        return True
    if len(markers['name_tokens']) >= 2:
        first = markers['name_tokens'][0]
        last = markers['name_tokens'][-1]
        if first and last and first in u_norm and last in u_norm:
            return True
    return False


def _name_profiles(variants: list[str]) -> list[dict[str, Any]]:
    profiles: list[dict[str, Any]] = []
    seen: set[str] = set()
    for variant in variants:
        tokens = _tokenize_name(variant)
        if not tokens:
            continue
        key = ' '.join(tokens)
        if key in seen:
            continue
        seen.add(key)
        profiles.append(
            {
                'tokens': tokens,
                'family': tokens[-1],
                'given_tokens': tokens[:-1],
            }
        )
    return profiles


def _author_match_score(author: dict[str, Any], profiles: list[dict[str, Any]]) -> float:
    author_given = _tokenize_name(author.get('given', ''))
    author_family_tokens = _tokenize_name(author.get('family', ''))
    author_family = author_family_tokens[-1] if author_family_tokens else ''
    best = 0.0

    for profile in profiles:
        score = 0.0
        profile_family = profile['family']
        profile_given = profile['given_tokens']

        if profile_family and author_family and profile_family == author_family:
            score += 0.7
        elif profile_family and author_family and (
            author_family.startswith(profile_family) or profile_family.startswith(author_family)
        ):
            score += 0.45

        if profile_given and author_given:
            given_exact = any(token in author_given for token in profile_given)
            if given_exact:
                score += 0.3
            else:
                # Handle initials, e.g., "Sadia" vs "S."
                given_initial_match = any(
                    token and any(g and g[0] == token[0] for g in author_given)
                    for token in profile_given
                )
                if given_initial_match:
                    score += 0.2
        elif not profile_given and author_given:
            # Single-token search term; allow weak match against given name.
            if any(profile_family == g for g in author_given):
                score += 0.25

        best = max(best, min(score, 1.0))
    return best


def _paper_passes_name_filter(item: dict[str, Any], profiles: list[dict[str, Any]]) -> bool:
    if not profiles:
        return True
    authors = item.get('author', []) or []
    if not authors:
        return False

    return any(_author_match_score(author, profiles) >= 0.65 for author in authors)


def _paper_from_crossref_item(item: dict[str, Any]) -> dict[str, Any]:
    title_values = item.get('title') or []
    container = item.get('container-title') or []
    issued = item.get('issued', {}).get('date-parts', [[None]])
    year = issued[0][0] if issued and issued[0] else None
    doi = item.get('DOI')
    url = item.get('URL')
    abstract_raw = item.get('abstract') or ''
    abstract_text = re.sub(r'<[^>]+>', ' ', abstract_raw)
    abstract_text = _normalize_text(abstract_text)
    title = title_values[0] if title_values else 'Untitled'
    dedupe_key = (doi or f'{title.lower()}::{year or "na"}').strip()

    return {
        'title': title,
        'authors': _author_names(item.get('author', [])),
        'source': container[0] if container else 'Unknown Source',
        'year': year,
        'citations': item.get('is-referenced-by-count', 0),
        'doi': doi,
        'url': url,
        'summary': abstract_text[:420] if abstract_text else 'Summary not provided by source.',
        '_dedupe_key': dedupe_key.lower(),
    }


@app.post('/search-research')
async def search_research(
    payload: ResearchRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> dict[str, Any]:
    full_name = (payload.full_name or '').strip()
    institution = (payload.institution or '').strip()
    name_variants = _name_variants(full_name)
    name_profiles = _name_profiles(name_variants)

    query_params_list: list[dict[str, Any]] = []
    query_modes_used: list[str] = []

    if name_variants and institution:
        for variant in name_variants:
            query_params_list.append(
                {
                    'query.author': variant,
                    'query.affiliation': institution,
                    'rows': 8,
                    'sort': 'relevance',
                    'order': 'desc',
                }
            )
        query_modes_used.append('name_and_institution')

    if name_variants:
        for variant in name_variants:
            query_params_list.append(
                {
                    'query.author': variant,
                    'rows': 6,
                    'sort': 'relevance',
                    'order': 'desc',
                }
            )
        query_modes_used.append('name_only')

    if institution:
        query_params_list.append(
            {
                'query.affiliation': institution,
                'rows': 6,
                'sort': 'relevance',
                'order': 'desc',
            }
        )
        query_modes_used.append('institution_only')

    papers_by_key: dict[str, dict[str, Any]] = {}
    try:
        async with httpx.AsyncClient(
            timeout=10,
            headers={'User-Agent': 'ShadowGraph/0.3 (mailto:research@shadowgraph.local)'},
        ) as client:
            for query_params in query_params_list:
                response = await client.get('https://api.crossref.org/works', params=query_params)
                response.raise_for_status()
                items = response.json().get('message', {}).get('items', [])
                for item in items:
                    if full_name and not _paper_passes_name_filter(item, name_profiles):
                        continue
                    paper = _paper_from_crossref_item(item)
                    key = paper.pop('_dedupe_key')
                    existing = papers_by_key.get(key)
                    if not existing or paper.get('citations', 0) > existing.get('citations', 0):
                        papers_by_key[key] = paper
    except httpx.HTTPError:
        papers_by_key = {}

    papers = sorted(
        papers_by_key.values(),
        key=lambda row: (row.get('citations', 0), row.get('year') or 0),
        reverse=True,
    )[:20]

    response_payload = {
        'full_name': full_name,
        'institution': institution,
        'name_variants_checked': name_variants,
        'query_modes_used': query_modes_used,
        'papers': papers,
        'provider': 'Crossref',
        'status': 'live-search',
    }
    store_scan_event(db, current_user, 'research_search', response_payload)
    return response_payload


@app.post('/check-breach')
async def check_breach(
    payload: BreachRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> dict[str, Any]:
    api_key = os.getenv('HIBP_API_KEY', '').strip()
    if not api_key:
        response_payload = {
            'email': payload.email,
            'breaches': [],
            'provider': 'Have I Been Pwned',
            'status': 'api-key-missing',
            'message': 'Set HIBP_API_KEY to enable live breach lookup.',
        }
        store_scan_event(db, current_user, 'breach_check', response_payload)
        return response_payload

    url = f'https://haveibeenpwned.com/api/v3/breachedaccount/{payload.email}'
    headers = {
        'hibp-api-key': api_key,
        'user-agent': 'ShadowGraph/0.3',
    }
    params = {'truncateResponse': 'false'}

    try:
        async with httpx.AsyncClient(timeout=10, headers=headers) as client:
            response = await client.get(url, params=params)
    except httpx.HTTPError:
        response_payload = {
            'email': payload.email,
            'breaches': [],
            'provider': 'Have I Been Pwned',
            'status': 'network-error',
        }
        store_scan_event(db, current_user, 'breach_check', response_payload)
        return response_payload

    if response.status_code == 404:
        response_payload = {
            'email': payload.email,
            'breaches': [],
            'provider': 'Have I Been Pwned',
            'status': 'no-breaches',
        }
        store_scan_event(db, current_user, 'breach_check', response_payload)
        return response_payload

    if response.status_code in (401, 403):
        response_payload = {
            'email': payload.email,
            'breaches': [],
            'provider': 'Have I Been Pwned',
            'status': 'auth-error',
            'message': 'HIBP API key rejected.',
        }
        store_scan_event(db, current_user, 'breach_check', response_payload)
        return response_payload

    if response.status_code == 429:
        response_payload = {
            'email': payload.email,
            'breaches': [],
            'provider': 'Have I Been Pwned',
            'status': 'rate-limited',
        }
        store_scan_event(db, current_user, 'breach_check', response_payload)
        return response_payload

    try:
        response.raise_for_status()
    except httpx.HTTPStatusError:
        response_payload = {
            'email': payload.email,
            'breaches': [],
            'provider': 'Have I Been Pwned',
            'status': 'upstream-error',
        }
        store_scan_event(db, current_user, 'breach_check', response_payload)
        return response_payload

    raw_breaches = response.json()
    breaches: list[dict[str, Any]] = []

    for breach in raw_breaches:
        exposed_data = breach.get('DataClasses', [])
        risk = 'high' if len(exposed_data) >= 4 else 'low'
        breaches.append(
            {
                'site': breach.get('Name'),
                'data': ', '.join(exposed_data[:6]),
                'date': breach.get('BreachDate'),
                'risk': risk,
                'records': breach.get('PwnCount', 0),
            }
        )

    response_payload = {
        'email': payload.email,
        'breaches': breaches,
        'provider': 'Have I Been Pwned',
        'status': 'live-check',
    }
    store_scan_event(db, current_user, 'breach_check', response_payload)
    return response_payload


def _normalize_text(text: str) -> str:
    return re.sub(r'\s+', ' ', text or '').strip()


def _extract_emails(text: str) -> list[str]:
    found = re.findall(r'[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}', text)
    return sorted(set(found))[:50]


def _extract_links(base_url: str, soup: BeautifulSoup) -> list[str]:
    links: list[str] = []
    for tag in soup.find_all('a', href=True):
        href = tag.get('href', '').strip()
        if not href:
            continue
        absolute = urljoin(base_url, href)
        parsed = urlparse(absolute)
        if parsed.scheme in ('http', 'https') and parsed.netloc:
            links.append(absolute)
    return links


def _looks_unreachable_profile(response: httpx.Response) -> bool:
    if response.status_code >= 400:
        return True

    text = (response.text or '').lower()
    title = ''
    try:
        soup = BeautifulSoup(response.text or '', 'html.parser')
        title = _normalize_text(soup.title.string if soup.title and soup.title.string else '').lower()
    except Exception:
        title = ''

    combined = f'{title} {text[:4000]}'
    unreachable_markers = [
        'page not found',
        '404',
        'profile not found',
        'user not found',
        'account not found',
        'this page does not exist',
        "this page doesn't exist",
        'doesn’t exist',
        'could not find',
        'no results found',
        'sorry, this page isn',
        'profile unavailable',
        'resource not found',
    ]
    return any(marker in combined for marker in unreachable_markers)


async def _run_scrape_pipeline(payload: ScrapeAggregateRequest) -> dict[str, Any]:
    keyword_set = [k.strip().lower() for k in payload.keywords if k.strip()]
    queue: deque[str] = deque(payload.seed_urls)
    visited: set[str] = set()
    pages: list[dict[str, Any]] = []
    discovered_links: set[str] = set()
    discovered_emails: set[str] = set()

    root_domains = {urlparse(url).netloc for url in payload.seed_urls}

    async with httpx.AsyncClient(timeout=12, follow_redirects=True, headers={'User-Agent': 'ShadowGraphCrawler/1.0'}) as client:
        while queue and len(visited) < payload.max_pages:
            current_url = queue.popleft()
            if current_url in visited:
                continue
            visited.add(current_url)

            try:
                response = await client.get(current_url)
                status_code = response.status_code
                html = response.text if status_code < 400 else ''
            except httpx.HTTPError:
                pages.append({'url': current_url, 'status': 'error', 'title': 'Unavailable', 'keyword_hits': {}})
                continue

            soup = BeautifulSoup(html, 'html.parser')
            title = _normalize_text(soup.title.string if soup.title and soup.title.string else 'Untitled')
            body_text = _normalize_text(soup.get_text(' ', strip=True))

            page_keyword_hits: dict[str, int] = {}
            lowered = body_text.lower()
            for keyword in keyword_set:
                count = lowered.count(keyword)
                if count:
                    page_keyword_hits[keyword] = count

            page_emails = _extract_emails(body_text)
            for email in page_emails:
                discovered_emails.add(email)

            links = _extract_links(current_url, soup)
            for link in links:
                discovered_links.add(link)
                if link in visited:
                    continue
                if payload.same_domain_only and urlparse(link).netloc not in root_domains:
                    continue
                if len(visited) + len(queue) >= payload.max_pages * 3:
                    continue
                queue.append(link)

            pages.append(
                {
                    'url': current_url,
                    'status': status_code,
                    'title': title[:180],
                    'word_count': len(body_text.split()),
                    'emails_found': page_emails[:10],
                    'keyword_hits': page_keyword_hits,
                }
            )

    keyword_totals: dict[str, int] = {k: 0 for k in keyword_set}
    for page in pages:
        for keyword, count in page.get('keyword_hits', {}).items():
            keyword_totals[keyword] = keyword_totals.get(keyword, 0) + count

    response_payload = {
        'seed_urls': payload.seed_urls,
        'pages': pages,
        'aggregates': {
            'pages_scraped': len(pages),
            'unique_links': len(discovered_links),
            'emails_found': sorted(discovered_emails)[:100],
            'keyword_totals': keyword_totals,
        },
        'status': 'scraped',
    }
    return response_payload


async def _run_scrape_job(job_id: str, user_id: int, payload: ScrapeAggregateRequest) -> None:
    started = datetime.now(timezone.utc)
    SCRAPE_JOBS[job_id]['status'] = 'running'
    SCRAPE_JOBS[job_id]['started_at'] = started.isoformat()
    try:
        result = await _run_scrape_pipeline(payload)
        SCRAPE_JOBS[job_id]['status'] = 'completed'
        SCRAPE_JOBS[job_id]['result'] = result
        SCRAPE_JOBS[job_id]['finished_at'] = datetime.now(timezone.utc).isoformat()
        db = SessionLocal()
        try:
            user = db.query(User).filter(User.id == user_id).first()
            if user:
                store_scan_event(db, user, 'web_scrape_aggregate', result)
                store_audit_event(db, 'scrape.job_completed', user.id, {'job_id': job_id})
        finally:
            db.close()
    except Exception as exc:
        SCRAPE_JOBS[job_id]['status'] = 'failed'
        SCRAPE_JOBS[job_id]['error'] = str(exc)
        SCRAPE_JOBS[job_id]['finished_at'] = datetime.now(timezone.utc).isoformat()
        db = SessionLocal()
        try:
            store_audit_event(db, 'scrape.job_failed', user_id, {'job_id': job_id, 'error': str(exc)})
        finally:
            db.close()


@app.post('/scrape-aggregate')
async def scrape_aggregate(
    payload: ScrapeAggregateRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> dict[str, Any]:
    if not payload.seed_urls:
        raise HTTPException(status_code=400, detail='Provide at least one seed URL.')
    response_payload = await _run_scrape_pipeline(payload)
    store_scan_event(db, current_user, 'web_scrape_aggregate', response_payload)
    store_audit_event(db, 'scrape.sync_run', current_user.id, {'pages': response_payload['aggregates']['pages_scraped']})
    return response_payload


@app.post('/jobs/scrape')
async def enqueue_scrape_job(
    payload: ScrapeAggregateRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> dict[str, Any]:
    job_id = str(uuid.uuid4())
    SCRAPE_JOBS[job_id] = {
        'job_id': job_id,
        'user_id': current_user.id,
        'status': 'queued',
        'created_at': datetime.now(timezone.utc).isoformat(),
        'payload': payload.model_dump(),
    }
    asyncio.create_task(_run_scrape_job(job_id, current_user.id, payload))
    store_audit_event(db, 'scrape.job_queued', current_user.id, {'job_id': job_id})
    return {'job_id': job_id, 'status': 'queued'}


@app.get('/jobs/scrape')
def list_scrape_jobs(current_user: User = Depends(get_current_user)) -> dict[str, Any]:
    jobs = [job for job in SCRAPE_JOBS.values() if job.get('user_id') == current_user.id]
    jobs.sort(key=lambda x: x.get('created_at', ''), reverse=True)
    return {'jobs': jobs[:100]}


@app.get('/jobs/scrape/{job_id}')
def get_scrape_job(job_id: str, current_user: User = Depends(get_current_user)) -> dict[str, Any]:
    job = SCRAPE_JOBS.get(job_id)
    if not job or job.get('user_id') != current_user.id:
        raise HTTPException(status_code=404, detail='Job not found')
    return job


def _schedule_runner(schedule_id: str) -> None:
    schedule = SCRAPE_SCHEDULES.get(schedule_id)
    if not schedule:
        return
    payload = ScrapeAggregateRequest(**schedule['payload'])
    job_id = str(uuid.uuid4())
    SCRAPE_JOBS[job_id] = {
        'job_id': job_id,
        'user_id': schedule['user_id'],
        'status': 'queued',
        'created_at': datetime.now(timezone.utc).isoformat(),
        'payload': payload.model_dump(),
        'schedule_id': schedule_id,
    }
    asyncio.create_task(_run_scrape_job(job_id, schedule['user_id'], payload))


@app.post('/crawler/schedules')
def create_scrape_schedule(
    payload: ScrapeScheduleRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> dict[str, Any]:
    schedule_id = str(uuid.uuid4())
    schedule_data = {
        'schedule_id': schedule_id,
        'user_id': current_user.id,
        'payload': payload.model_dump(),
        'interval_minutes': payload.interval_minutes,
        'created_at': datetime.now(timezone.utc).isoformat(),
        'status': 'active',
    }
    SCRAPE_SCHEDULES[schedule_id] = schedule_data
    if scheduler:
        scheduler.add_job(_schedule_runner, 'interval', minutes=payload.interval_minutes, args=[schedule_id], id=schedule_id, replace_existing=True)
    store_audit_event(db, 'crawler.schedule_created', current_user.id, {'schedule_id': schedule_id, 'interval_minutes': payload.interval_minutes})
    return schedule_data


@app.get('/crawler/schedules')
def list_scrape_schedules(current_user: User = Depends(get_current_user)) -> dict[str, Any]:
    schedules = [s for s in SCRAPE_SCHEDULES.values() if s.get('user_id') == current_user.id]
    schedules.sort(key=lambda x: x.get('created_at', ''), reverse=True)
    return {'schedules': schedules}


@app.delete('/crawler/schedules/{schedule_id}')
def delete_scrape_schedule(schedule_id: str, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)) -> dict[str, Any]:
    schedule = SCRAPE_SCHEDULES.get(schedule_id)
    if not schedule or schedule.get('user_id') != current_user.id:
        raise HTTPException(status_code=404, detail='Schedule not found')
    SCRAPE_SCHEDULES.pop(schedule_id, None)
    if scheduler and scheduler.get_job(schedule_id):
        scheduler.remove_job(schedule_id)
    store_audit_event(db, 'crawler.schedule_deleted', current_user.id, {'schedule_id': schedule_id})
    return {'status': 'deleted', 'schedule_id': schedule_id}


def _risk_tips(score: int, breach_exposure: int, leak_indicators: int) -> list[str]:
    tips: list[str] = []
    if breach_exposure >= 60:
        tips.append('Prioritize credential rotation and enable MFA for all critical accounts.')
    if leak_indicators >= 60:
        tips.append('Set monitoring alerts for new data leaks and suspicious profile activity.')
    if score >= 70:
        tips.append('Reduce public profile metadata and remove stale accounts.')
    if not tips:
        tips.append('Maintain periodic scans and keep account hygiene controls enabled.')
    return tips


def _category_for_platform(platform_name: str) -> str:
    lowered = (platform_name or '').lower()
    if any(k in lowered for k in ('github', 'leetcode', 'geeksforgeeks', 'stack overflow', 'stackoverflow')):
        return 'Coding'
    if any(k in lowered for k in ('ieee', 'research', 'scholar')):
        return 'Academic'
    if any(k in lowered for k in ('blog', 'substack', 'medium', 'hashnode', 'dev')):
        return 'Blogs'
    return 'Social'


def _build_footprint_summary(db: Session, current_user: User) -> dict[str, Any]:
    events = (
        db.query(ScanEvent)
        .filter(ScanEvent.user_id == current_user.id)
        .order_by(ScanEvent.created_at.desc())
        .limit(250)
        .all()
    )

    profiles: dict[str, dict[str, Any]] = {}
    papers_count = 0
    breaches_count = 0
    active_platforms: set[str] = set()
    categories = {'Social': 0, 'Coding': 0, 'Academic': 0, 'Blogs': 0}

    for event in events:
        payload = _safe_json(event.payload_json)
        if event.scan_type == 'username_scan':
            queried_value = str(payload.get('username', '')).strip()
            owner = str(payload.get('query_owner', '')).strip().lower()
            if owner:
                is_self_query = owner == 'self'
            else:
                is_self_query = _is_self_query_value(queried_value, current_user)
            if not is_self_query:
                continue
            for row in payload.get('results', []):
                if row.get('status') != 'Found':
                    continue
                platform = row.get('platform', 'Unknown')
                profile_url = row.get('profile_url', '')
                key = f'{platform}:{profile_url}'
                if key not in profiles:
                    category = _category_for_platform(platform)
                    profiles[key] = {
                        'platform': platform,
                        'category': category,
                        'username': row.get('username', ''),
                        'profile_url': profile_url,
                    }
        elif event.scan_type == 'face_scan':
            owner = str(payload.get('query_owner', '')).strip().lower()
            if owner and owner != 'self':
                continue
            for row in payload.get('online_presence', []):
                if not owner and not _is_self_profile_username(str(row.get('username', '')), current_user):
                    continue
                platform = row.get('platform', 'Unknown')
                profile_url = row.get('profile_url', '')
                key = f'{platform}:{profile_url}'
                if key not in profiles:
                    profiles[key] = {
                        'platform': platform,
                        'category': row.get('category') or _category_for_platform(platform),
                        'username': row.get('username', ''),
                        'profile_url': profile_url,
                        'image_preview': row.get('image_preview', ''),
                    }
        elif event.scan_type == 'research_search':
            papers_count += len(payload.get('papers', []))
        elif event.scan_type == 'breach_check':
            breaches_count += len(payload.get('breaches', []))

    for row in profiles.values():
        platform = row.get('platform')
        if platform:
            active_platforms.add(platform)
        category = row.get('category', 'Social')
        categories[category] = categories.get(category, 0) + 1

    profile_rows = sorted(profiles.values(), key=lambda x: (x.get('category', ''), x.get('platform', '')))[:120]
    return {
        'total_accounts_found': len(profile_rows),
        'active_platforms': sorted(active_platforms),
        'categories': categories,
        'research_papers_found': papers_count,
        'breach_records_found': breaches_count,
        'profiles': profile_rows,
    }


def _build_reputation_insight(summary: dict[str, Any]) -> dict[str, Any]:
    accounts = int(summary.get('total_accounts_found', 0))
    papers = int(summary.get('research_papers_found', 0))
    breaches = int(summary.get('breach_records_found', 0))

    visibility_score = min(100, accounts * 8 + papers * 3)
    exposure_penalty = min(40, breaches * 8)
    reputation_score = max(0, min(100, 55 + visibility_score // 2 - exposure_penalty))

    highlights: list[str] = []
    if accounts >= 5:
        highlights.append('You are highly visible across multiple public platforms.')
    elif accounts >= 2:
        highlights.append('You have moderate online visibility.')
    else:
        highlights.append('You have low online visibility based on recent scans.')

    if papers > 0:
        highlights.append(f'Academic visibility detected: {papers} publication record(s).')
    if breaches > 0:
        highlights.append(f'Exposure warning: {breaches} breach record(s) found.')
    else:
        highlights.append('No breach records found in recent checks.')

    actions: list[str] = []
    if breaches > 0:
        actions.append('Enable multi-factor authentication and rotate important passwords.')
    if accounts > 8:
        actions.append('Review old profiles and remove outdated public information.')
    if papers == 0:
        actions.append('If you publish work, add consistent profile links for discoverability.')
    if not actions:
        actions.append('Keep scanning periodically to maintain a healthy reputation profile.')

    return {
        'reputation_score': reputation_score,
        'visibility_score': visibility_score,
        'exposure_penalty': exposure_penalty,
        'highlights': highlights[:4],
        'recommended_actions': actions[:4],
        'status': 'calculated',
    }


@app.post('/calculate-risk')
def calculate_risk(
    payload: RiskRequest | None = None,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> dict[str, Any]:
    payload = payload or RiskRequest()
    weights = {
        'public_profiles': 0.22,
        'research_visibility': 0.18,
        'breach_exposure': 0.35,
        'leak_indicators': 0.25,
    }

    score = round(
        payload.public_profiles * weights['public_profiles']
        + payload.research_visibility * weights['research_visibility']
        + payload.breach_exposure * weights['breach_exposure']
        + payload.leak_indicators * weights['leak_indicators']
    )

    tips = _risk_tips(score, payload.breach_exposure, payload.leak_indicators)

    response_payload = {
        'score': score,
        'vector': [
            payload.public_profiles,
            payload.research_visibility,
            payload.breach_exposure,
            payload.leak_indicators,
        ],
        'labels': ['Public Profiles', 'Research Visibility', 'Breach Exposure', 'Data Leak Indicators'],
        'tips': tips,
        'status': 'calculated',
    }
    store_scan_event(db, current_user, 'risk_calculation', response_payload)
    return response_payload


@app.get('/digital-footprint-summary')
def digital_footprint_summary(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)) -> dict[str, Any]:
    summary = _build_footprint_summary(db, current_user)
    payload = {
        'summary': summary,
        'status': 'compiled',
    }
    store_scan_event(db, current_user, 'digital_footprint_summary', payload)
    return payload


@app.get('/profile-dashboard')
def profile_dashboard(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)) -> dict[str, Any]:
    summary = _build_footprint_summary(db, current_user)
    settings = _ensure_user_settings(db, current_user)
    events = (
        db.query(ScanEvent)
        .filter(ScanEvent.user_id == current_user.id)
        .order_by(ScanEvent.created_at.desc())
        .limit(200)
        .all()
    )

    by_day: dict[str, int] = defaultdict(int)
    for event in events:
        day = event.created_at.astimezone(timezone.utc).strftime('%Y-%m-%d')
        by_day[day] += 1
    activity = [{'date': day, 'count': count} for day, count in sorted(by_day.items())][-30:]

    return {
        'profile': {
            'name': current_user.name,
            'email': current_user.email,
            'member_since': current_user.created_at.isoformat(),
            'privacy': _serialize_settings(settings),
        },
        'stats': {
            'accounts_found': summary['total_accounts_found'],
            'platforms': len(summary['active_platforms']),
            'papers': summary['research_papers_found'],
            'breaches': summary['breach_records_found'],
        },
        'activity': activity,
        'top_profiles': summary['profiles'][:12],
        'status': 'dashboard-ready',
    }


@app.get('/reputation-insight')
def reputation_insight(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)) -> dict[str, Any]:
    summary = _build_footprint_summary(db, current_user)
    insight = _build_reputation_insight(summary)
    payload = {'insight': insight, 'summary': summary, 'status': 'calculated'}
    store_scan_event(db, current_user, 'reputation_insight', payload)
    return payload


def _recent_scan_events(db: Session, user_id: int, limit: int = 300) -> list[ScanEvent]:
    return (
        db.query(ScanEvent)
        .filter(ScanEvent.user_id == user_id)
        .order_by(ScanEvent.created_at.asc())
        .limit(limit)
        .all()
    )


@app.get('/ai-narrative')
def ai_narrative(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)) -> dict[str, Any]:
    summary = _build_footprint_summary(db, current_user)
    insight = _build_reputation_insight(summary)
    stories = [
        {
            'title': 'Your Public Presence',
            'body': f"You currently appear on {summary['total_accounts_found']} public account(s) across {len(summary['active_platforms'])} platform(s).",
        },
        {
            'title': 'Academic & Professional Footprint',
            'body': f"Detected {summary['research_papers_found']} publication record(s), helping map your academic visibility.",
        },
        {
            'title': 'Exposure Snapshot',
            'body': f"Recent checks found {summary['breach_records_found']} breach record(s). Reputation score is {insight['reputation_score']}/100.",
        },
        {
            'title': 'Action Plan',
            'body': ' '.join(insight.get('recommended_actions', [])) or 'Keep profiles updated and scan regularly.',
        },
    ]
    return {'stories': stories, 'status': 'generated'}


@app.get('/privacy-alerts')
def privacy_alerts(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)) -> dict[str, Any]:
    summary = _build_footprint_summary(db, current_user)
    alerts: list[dict[str, Any]] = []
    if summary['breach_records_found'] > 0:
        alerts.append({'severity': 'high', 'title': 'Breach records found', 'message': 'Rotate passwords and enable multi-factor authentication.'})
    if summary['total_accounts_found'] > 10:
        alerts.append({'severity': 'medium', 'title': 'High public visibility', 'message': 'Review old accounts and hide outdated personal information.'})
    if not alerts:
        alerts.append({'severity': 'low', 'title': 'No major privacy warning', 'message': 'Keep scanning periodically to maintain profile hygiene.'})
    return {'alerts': alerts, 'status': 'analyzed'}


@app.get('/skill-radar')
def skill_radar(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)) -> dict[str, Any]:
    summary = _build_footprint_summary(db, current_user)
    coding = summary['categories'].get('Coding', 0)
    academic = summary['categories'].get('Academic', 0)
    social = summary['categories'].get('Social', 0)
    blogs = summary['categories'].get('Blogs', 0)
    skills = [
        {'name': 'Coding Presence', 'score': min(100, coding * 14 + 10)},
        {'name': 'Research Visibility', 'score': min(100, summary['research_papers_found'] * 12 + academic * 8)},
        {'name': 'Community Reach', 'score': min(100, social * 10 + blogs * 8)},
        {'name': 'Profile Completeness', 'score': min(100, summary['total_accounts_found'] * 6)},
    ]
    gaps = [row['name'] for row in skills if row['score'] < 45]
    return {'skills': skills, 'gaps': gaps, 'status': 'mapped'}


@app.get('/networking-opportunities')
def networking_opportunities(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)) -> dict[str, Any]:
    summary = _build_footprint_summary(db, current_user)
    interests: list[str] = []
    if summary['categories'].get('Coding', 0) >= 2:
        interests.append('Open-source communities and developer meetups')
    if summary['research_papers_found'] > 0:
        interests.append('Research collaborators and publication groups')
    if summary['categories'].get('Social', 0) >= 2:
        interests.append('Professional networking and content communities')
    if not interests:
        interests.append('Starter communities for building your public profile')
    opportunities = [{'title': item, 'action': 'Join and contribute consistently'} for item in interests]
    return {'opportunities': opportunities, 'status': 'suggested'}


@app.get('/activity-timeline')
def activity_timeline(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)) -> dict[str, Any]:
    events = _recent_scan_events(db, current_user.id, limit=500)
    timeline = []
    for event in events:
        payload = _safe_json(event.payload_json)
        timeline.append(
            {
                'date': event.created_at.isoformat(),
                'type': event.scan_type,
                'summary': payload.get('status') or 'completed',
            }
        )
    return {'timeline': timeline[-180:], 'status': 'compiled'}


@app.get('/public-persona-score')
def public_persona_score(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)) -> dict[str, Any]:
    summary = _build_footprint_summary(db, current_user)
    insight = _build_reputation_insight(summary)
    activity = len(_recent_scan_events(db, current_user.id, 200))
    score = max(0, min(100, insight['reputation_score'] + min(20, activity // 8)))
    suggestions = [
        'Add missing professional profiles to improve discoverability.',
        'Keep profile details consistent across platforms.',
        'Publish regular updates or contributions to improve visibility.',
    ]
    return {'persona_score': score, 'suggestions': suggestions, 'status': 'calculated'}


@app.get('/achievements')
def achievements(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)) -> dict[str, Any]:
    summary = _build_footprint_summary(db, current_user)
    badges = []
    if summary['total_accounts_found'] >= 5:
        badges.append({'id': 'visible-builder', 'title': 'Visible Builder', 'description': '5+ public profiles discovered.'})
    if summary['research_papers_found'] >= 1:
        badges.append({'id': 'researcher', 'title': 'Researcher', 'description': 'At least one publication found.'})
    if summary['breach_records_found'] == 0:
        badges.append({'id': 'clean-slate', 'title': 'Clean Slate', 'description': 'No breach records in recent checks.'})
    if not badges:
        badges.append({'id': 'starter', 'title': 'Starter', 'description': 'Run more modules to unlock achievements.'})
    return {'badges': badges, 'status': 'awarded'}


@app.get('/predictive-analytics')
def predictive_analytics(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)) -> dict[str, Any]:
    summary = _build_footprint_summary(db, current_user)
    base = max(20, summary['total_accounts_found'] * 5)
    forecast = []
    for month in range(1, 7):
        forecast.append({'month': month, 'visibility_index': min(100, base + month * 4)})
    actions = [
        'Post or contribute consistently on 2 core platforms.',
        'Keep profile details updated monthly.',
        'Link your coding and publication profiles together.',
    ]
    return {'forecast': forecast, 'actions': actions, 'status': 'predicted'}


@app.get('/ethical-verification')
def ethical_verification(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)) -> dict[str, Any]:
    summary = _build_footprint_summary(db, current_user)
    checklist = [
        {'item': 'Only public data is analyzed', 'status': True},
        {'item': 'No private account access attempted', 'status': True},
        {'item': 'Profile ownership verification available', 'status': summary['total_accounts_found'] > 0},
    ]
    return {'checklist': checklist, 'status': 'verified'}


def _safe_json(raw: str) -> dict[str, Any]:
    try:
        value = json.loads(raw)
        return value if isinstance(value, dict) else {}
    except json.JSONDecodeError:
        return {}


@app.get('/graph-data')
def graph_data(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)) -> dict[str, Any]:
    events = (
        db.query(ScanEvent)
        .filter(ScanEvent.user_id == current_user.id)
        .order_by(ScanEvent.created_at.desc())
        .limit(200)
        .all()
    )

    user_node_id = f'user-{current_user.id}'
    nodes: dict[str, dict[str, Any]] = {
        user_node_id: {
            'data': {
                'id': user_node_id,
                'label': current_user.name,
                'type': 'User',
            }
        }
    }
    edges: dict[str, dict[str, Any]] = {}

    def add_node(node_id: str, label: str, node_type: str) -> None:
        if node_id not in nodes:
            nodes[node_id] = {'data': {'id': node_id, 'label': label, 'type': node_type}}

    def add_edge(source: str, target: str, label: str) -> None:
        edge_id = f'{source}->{target}:{label}'
        if edge_id not in edges:
            edges[edge_id] = {'data': {'source': source, 'target': target, 'label': label}}

    for event in events:
        payload = _safe_json(event.payload_json)

        if event.scan_type in ('username_scan', 'face_scan'):
            matches = payload.get('results', []) if event.scan_type == 'username_scan' else payload.get('matched_profiles', [])
            for match in matches:
                platform = match.get('platform')
                if not platform:
                    continue
                node_id = f'platform:{platform.lower()}'
                add_node(node_id, platform, 'Platform')
                add_edge(user_node_id, node_id, 'appears_on')

        if event.scan_type == 'research_search':
            for idx, paper in enumerate(payload.get('papers', [])[:15]):
                title = paper.get('title', 'Untitled')
                node_id = f'paper:{abs(hash(title)) % 10000000}:{idx}'
                add_node(node_id, title[:60], 'Research Paper')
                add_edge(user_node_id, node_id, 'authored')

        if event.scan_type == 'breach_check':
            for breach in payload.get('breaches', [])[:20]:
                site = breach.get('site')
                if not site:
                    continue
                node_id = f'breach:{site.lower()}'
                add_node(node_id, site, 'Breach Event')
                add_edge(user_node_id, node_id, 'exposed_in')

    return {
        'nodes': list(nodes.values()),
        'edges': list(edges.values()),
        'summary': {
            'nodes': len(nodes),
            'edges': len(edges),
            'events_ingested': len(events),
        },
        'status': 'dynamic-graph',
    }


@app.get('/report/history')
def report_history(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)) -> dict[str, Any]:
    events = (
        db.query(ScanEvent)
        .filter(ScanEvent.user_id == current_user.id)
        .order_by(ScanEvent.created_at.desc())
        .limit(200)
        .all()
    )
    rows = []
    for event in events:
        payload = _safe_json(event.payload_json)
        rows.append(
            {
                'id': event.id,
                'scan_type': event.scan_type,
                'created_at': event.created_at.isoformat(),
                'summary': {
                    'keys': list(payload.keys())[:6],
                    'status': payload.get('status'),
                },
            }
        )
    return {'events': rows}


@app.get('/audit/events')
def audit_events(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)) -> dict[str, Any]:
    rows = (
        db.query(AuditEvent)
        .filter((AuditEvent.user_id == current_user.id) | (AuditEvent.user_id.is_(None)))
        .order_by(AuditEvent.created_at.desc())
        .limit(200)
        .all()
    )
    result = []
    for row in rows:
        result.append(
            {
                'id': row.id,
                'event_type': row.event_type,
                'user_id': row.user_id,
                'details': _safe_json(row.details_json),
                'created_at': row.created_at.isoformat(),
            }
        )
    return {'events': result}


@app.get('/report/export/json')
def export_report_json(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)) -> dict[str, Any]:
    summary = _build_footprint_summary(db, current_user)
    insight = _build_reputation_insight(summary)
    timeline = _recent_scan_events(db, current_user.id, limit=200)
    return {
        'user': serialize_user(current_user),
        'summary': summary,
        'reputation_insight': insight,
        'timeline': [
            {'date': event.created_at.isoformat(), 'type': event.scan_type}
            for event in timeline
        ],
        'status': 'exported',
    }


@app.get('/report/export/pdf')
def export_report_pdf(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)) -> StreamingResponse:
    events = (
        db.query(ScanEvent)
        .filter(ScanEvent.user_id == current_user.id)
        .order_by(ScanEvent.created_at.desc())
        .limit(300)
        .all()
    )

    counts: dict[str, int] = defaultdict(int)
    risk_score = None
    breaches_count = 0
    matched_profiles = 0
    papers_count = 0

    for event in events:
        counts[event.scan_type] += 1
        payload = _safe_json(event.payload_json)
        if event.scan_type == 'risk_calculation' and risk_score is None:
            risk_score = payload.get('score')
        if event.scan_type == 'breach_check':
            breaches_count += len(payload.get('breaches', []))
        if event.scan_type == 'face_scan':
            matched_profiles += len(payload.get('matched_profiles', []))
        if event.scan_type == 'research_search':
            papers_count += len(payload.get('papers', []))

    buffer = io.BytesIO()
    pdf = canvas.Canvas(buffer, pagesize=letter)
    width, height = letter
    y = height - 54

    pdf.setFont('Helvetica-Bold', 18)
    pdf.drawString(48, y, 'ShadowGraph Exposure Report')
    y -= 24
    pdf.setFont('Helvetica', 10)
    pdf.drawString(48, y, f"Generated: {datetime.now(timezone.utc).strftime('%Y-%m-%d %H:%M:%SZ')}")
    y -= 14
    pdf.drawString(48, y, f"User: {current_user.email}")
    y -= 28

    pdf.setFont('Helvetica-Bold', 12)
    pdf.drawString(48, y, 'Summary')
    y -= 18
    pdf.setFont('Helvetica', 10)
    lines = [
        f"Total scan events: {len(events)}",
        f"Latest risk score: {risk_score if risk_score is not None else 'N/A'}",
        f"Matched profiles detected: {matched_profiles}",
        f"Research papers detected: {papers_count}",
        f"Breach entries detected: {breaches_count}",
    ]
    for line in lines:
        pdf.drawString(58, y, line)
        y -= 14

    y -= 10
    pdf.setFont('Helvetica-Bold', 12)
    pdf.drawString(48, y, 'Scan Type Counts')
    y -= 18
    pdf.setFont('Helvetica', 10)
    for scan_type, count in sorted(counts.items()):
        pdf.drawString(58, y, f'{scan_type}: {count}')
        y -= 14
        if y < 72:
            pdf.showPage()
            y = height - 54
            pdf.setFont('Helvetica', 10)

    pdf.save()
    buffer.seek(0)
    filename = f"shadowgraph-report-{current_user.id}.pdf"
    return StreamingResponse(
        buffer,
        media_type='application/pdf',
        headers={'Content-Disposition': f'attachment; filename=\"{filename}\"'},
    )
