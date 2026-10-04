#!/usr/bin/env bash
# Build both web apps (if needed) and start the Care-Bridge API on port 8000.
# The API serves the caregiver Mini App at / and Ruth's explainer at /explain/.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

if [ ! -x services/api/.venv/bin/uvicorn ]; then
  python3 -m venv services/api/.venv
  services/api/.venv/bin/pip install -q -r services/api/requirements.txt
fi
for app in miniapp explainer; do
  if [ ! -d "apps/$app/node_modules" ]; then (cd "apps/$app" && npm install --silent); fi
  if [ "${REBUILD:-1}" = "1" ] || [ ! -d "apps/$app/dist" ]; then (cd "apps/$app" && npm run build --silent); fi
done

echo "Care-Bridge API on http://127.0.0.1:8000  (Mini App at /, explainer at /explain/)"
cd services/api
exec .venv/bin/uvicorn app.main:app --host 127.0.0.1 --port 8000
