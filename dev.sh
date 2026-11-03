#!/usr/bin/env bash
# Start the Python API (port 8000) and the React dev server (port 5173) together.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")" && pwd)"

if [ ! -d "$ROOT/backend/.venv" ]; then
  echo "→ Creating Python virtualenv"
  python3 -m venv "$ROOT/backend/.venv"
  "$ROOT/backend/.venv/bin/pip" install -q -r "$ROOT/backend/requirements.txt"
fi
if [ ! -d "$ROOT/frontend/node_modules" ]; then
  echo "→ Installing frontend packages"
  (cd "$ROOT/frontend" && npm install --no-audit --no-fund)
fi

trap 'kill 0' EXIT
(cd "$ROOT/backend" && .venv/bin/uvicorn app.main:app --reload --port 8000) &
(cd "$ROOT/frontend" && npm run dev) &
echo "→ Open http://localhost:5173"
wait
