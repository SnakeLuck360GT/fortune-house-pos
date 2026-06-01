#!/bin/bash
# Fortune House printer bridge — auto-restart wrapper
# Usage: ./start.sh
# This is called by the systemd service (see README.md)

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

echo "[start.sh] Starting printer bridge from $SCRIPT_DIR"

while true; do
  echo "[start.sh] Launching index.js at $(date)"
  node "$SCRIPT_DIR/index.js"
  EXIT_CODE=$?
  echo "[start.sh] Process exited with code $EXIT_CODE — restarting in 2s..."
  sleep 2
done
