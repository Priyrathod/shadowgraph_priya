#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
BACKEND_DIR="$ROOT_DIR/backend"
FRONTEND_DIR="$ROOT_DIR/frontend"

cleanup() {
  echo ""
  echo "Stopping ShadowGraph local services..."
  jobs -p | xargs -r kill 2>/dev/null || true
}
trap cleanup EXIT INT TERM

echo "Starting ShadowGraph backend..."
(
  cd "$BACKEND_DIR"
  source .venv/bin/activate
  set -a
  source .env
  set +a
  python3 -m uvicorn app.main:app --reload --host 127.0.0.1 --port 8000
) &
BACK_PID=$!

# Give backend a moment before frontend starts
sleep 2

echo "Starting ShadowGraph frontend..."
(
  cd "$FRONTEND_DIR"
  npm run dev -- --host 127.0.0.1 --port 5173
) &
FRONT_PID=$!

echo ""
echo "ShadowGraph is starting:"
echo "- Backend:  http://127.0.0.1:8000"
echo "- Frontend: http://127.0.0.1:5173"
echo ""
echo "Press Ctrl+C to stop both."

wait "$BACK_PID" "$FRONT_PID"
