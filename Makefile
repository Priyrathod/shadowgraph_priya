.PHONY: backend-install backend-migrate backend-run backend-test backend-preflight backend-runtime frontend-install frontend-test frontend-build all-tests

backend-install:
	cd backend && python -m pip install -r requirements.txt -r requirements-dev.txt

backend-preflight:
	cd backend && python scripts/preflight.py

backend-runtime:
	cd backend && python scripts/verify_runtime.py

backend-migrate:
	cd backend && alembic upgrade head

backend-run:
	cd backend && uvicorn app.main:app --reload --port 8000

backend-test:
	cd backend && pytest -q

frontend-install:
	cd frontend && npm install

frontend-build:
	cd frontend && npm run build

frontend-test:
	cd frontend && npm run test:e2e

all-tests: backend-test frontend-test
