#!/usr/bin/env bash
set -e
cd "$(dirname "$0")"

if ! command -v node >/dev/null 2>&1; then
  echo "[ERROR] Node.js v20+ is required. Download from https://nodejs.org/"
  exit 1
fi

if [ ! -f ".env" ] && [ -f ".env.example" ]; then
  cp ".env.example" ".env"
  echo "[INFO] Created .env from .env.example."
fi

if [ ! -d "node_modules" ]; then
  echo "[INFO] Installing dependencies..."
  npm install
fi

(
  for _ in $(seq 1 30); do
    if curl -sf http://localhost:3000 >/dev/null 2>&1; then
      if command -v xdg-open >/dev/null 2>&1; then
        xdg-open "http://localhost:3000" >/dev/null 2>&1 || true
      elif command -v open >/dev/null 2>&1; then
        open "http://localhost:3000" >/dev/null 2>&1 || true
      fi
      break
    fi
    sleep 0.5
  done
) &

echo "[INFO] Launching AgriNexus at http://localhost:3000 ..."
npm run dev
