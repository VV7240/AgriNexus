#!/usr/bin/env bash
set -e
cd "$(dirname "$0")"

echo "=================================================="
echo "  AgriNexus - Post-Harvest Decision Intelligence"
echo "=================================================="

if ! command -v node >/dev/null 2>&1; then
  echo "[ERROR] Node.js is not installed. Install Node.js v20+ from https://nodejs.org/"
  read -r -p "Press Enter to exit..."
  exit 1
fi

if [ ! -f ".env" ] && [ -f ".env.example" ]; then
  cp ".env.example" ".env"
  echo "[INFO] Created .env from .env.example (add GEMINI_API_KEY for live AI Assist)."
fi

if [ ! -d "node_modules" ]; then
  echo "[INFO] First-time setup: installing dependencies..."
  npm install
fi

(
  for _ in $(seq 1 30); do
    if curl -sf http://localhost:3000 >/dev/null 2>&1; then
      if command -v open >/dev/null 2>&1; then
        open "http://localhost:3000"
      elif command -v xdg-open >/dev/null 2>&1; then
        xdg-open "http://localhost:3000"
      fi
      break
    fi
    sleep 0.5
  done
) &

echo "[INFO] Starting AgriNexus at http://localhost:3000 (Ctrl+C to stop)..."
npm run dev
