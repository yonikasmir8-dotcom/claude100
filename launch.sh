#!/usr/bin/env bash
# Barry's Israel — launch mockup in browser
set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
FILE="$SCRIPT_DIR/barrys-israel.html"
PORT=8080

# Kill any previous instance on this port
fuser -k ${PORT}/tcp 2>/dev/null || true

# Start Python server in background
cd "$SCRIPT_DIR"
python3 -m http.server $PORT --bind 127.0.0.1 &>/tmp/barrys-server.log &
SERVER_PID=$!
echo "Server started (PID $SERVER_PID) on http://127.0.0.1:$PORT"

# Wait briefly for server to be ready
sleep 0.5

# Open browser — try common launchers in order
URL="http://127.0.0.1:$PORT/barrys-israel.html"
if command -v xdg-open &>/dev/null; then
    xdg-open "$URL"
elif command -v open &>/dev/null; then      # macOS
    open "$URL"
elif command -v google-chrome &>/dev/null; then
    google-chrome "$URL"
elif command -v chromium-browser &>/dev/null; then
    chromium-browser "$URL"
elif command -v firefox &>/dev/null; then
    firefox "$URL"
else
    echo "No browser found. Open manually: $URL"
    echo "(or just open barrys-israel.html directly in your browser)"
fi
