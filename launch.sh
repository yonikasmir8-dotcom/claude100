#!/usr/bin/env bash
# Serve Rebel Run locally and open it in the default browser.
set -e
cd "$(dirname "${BASH_SOURCE[0]}")"
PORT="${PORT:-8080}"
URL="http://127.0.0.1:$PORT/index.html"
python3 -m http.server "$PORT" --bind 127.0.0.1 >/dev/null 2>&1 &
trap 'kill $!' EXIT
sleep 0.5
echo "Rebel Run running at $URL  (Ctrl+C to stop)"
if command -v xdg-open >/dev/null; then xdg-open "$URL"; elif command -v open >/dev/null; then open "$URL"; fi
wait
