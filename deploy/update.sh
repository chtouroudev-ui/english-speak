#!/usr/bin/env bash
# Get the newest version and restart. Your history and settings are kept.
set -euo pipefail
cd "$(dirname "$0")/.."
SUDO=""; [[ $EUID -ne 0 ]] && SUDO="sudo"
DC="$SUDO docker compose"

git pull --ff-only

# Text only: switch the image model off and free its disk space (it was too slow on 2 CPUs).
if grep -q '^VISION_MODEL=..*' .env; then
  OLD="$(grep '^VISION_MODEL=' .env | cut -d= -f2-)"
  sed -i 's/^VISION_MODEL=.*/VISION_MODEL=/' .env
  grep -q '^VISION_ENABLED=' .env && sed -i 's/^VISION_ENABLED=.*/VISION_ENABLED=false/' .env || echo 'VISION_ENABLED=false' >> .env
  $DC exec -T ollama ollama rm "$OLD" 2>/dev/null || true
fi

# Older installs: add the internal entry used by the Cloudflare tunnel.
if ! grep -q 'http://:8081' Caddyfile && grep -q '^COMPOSE_PROFILES=.*tunnel' .env; then
  bash deploy/tunnel.sh >/dev/null || true
fi

$DC up -d --build
# Settings saved in the app win over .env, so turn the image page off there too.
$DC exec -T app python -c "from app import db; db.save_settings({'vision_enabled': False})" >/dev/null 2>&1 || true

echo
echo "Updated."
if grep -q '^COMPOSE_PROFILES=.*tunnel' .env; then
  sleep 3
  bash deploy/tunnel.sh | grep -E 'Open:' || true
fi
