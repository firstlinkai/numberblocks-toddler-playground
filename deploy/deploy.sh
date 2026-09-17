#!/usr/bin/env bash
# Build locally, ship the static output, rebuild the container on the VPS.
#
# The build happens HERE, not on the server: the local checkout is the only
# place that has src/players.local.js and the personal recordings, and those
# are gitignored precisely so they never reach a git remote. A server-side
# `git pull && npm run build` would quietly produce the generic version.
#
# Usage: VPS=user@host ./deploy/deploy.sh [remote-dir]
set -euo pipefail

REMOTE_DIR="${2:-/opt/numberblocks}"
: "${VPS:?set VPS=user@host}"

cd "$(dirname "$0")/.."

echo "==> building"
npm run build

echo "==> checking the build actually carries the local overrides"
if ! ls dist/audio/local-*.wav >/dev/null 2>&1; then
  echo "    WARNING: no local-*.wav in dist - this is the generic build." >&2
  echo "    src/players.local.js and the recordings are missing from this checkout." >&2
fi

echo "==> syncing to $VPS:$REMOTE_DIR"
ssh "$VPS" "mkdir -p '$REMOTE_DIR'"
rsync -az --delete dist/ "$VPS:$REMOTE_DIR/dist/"
rsync -az deploy/Dockerfile deploy/nginx.conf deploy/docker-compose.yml "$VPS:$REMOTE_DIR/deploy/"

echo "==> rebuilding container"
ssh "$VPS" "cd '$REMOTE_DIR' && docker compose -f deploy/docker-compose.yml --env-file deploy/.env up -d --build"

echo "==> done"
