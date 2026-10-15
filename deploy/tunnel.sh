#!/usr/bin/env bash
# Gives the app a public https://....trycloudflare.com address through a free Cloudflare tunnel.
# Use it when you cannot open ports 80/443 (for example, no access to the Oracle Cloud console).
# Run again at any time to see the current address. The address changes when the server restarts.
set -euo pipefail
cd "$(dirname "$0")/.."
SUDO=""; [[ $EUID -ne 0 ]] && SUDO="sudo"
DC="$SUDO docker compose"

[[ -f Caddyfile && -f .env ]] || { echo "Run deploy/install.sh first."; exit 1; }

# Older installs: add the internal :8081 entry, with the same user and password.
if ! grep -q 'http://:8081' Caddyfile; then
  LOGIN="$(awk '/basic_auth/{getline; print; exit}' Caddyfile | xargs)"
  {
    echo
    echo "http://:8081 {"
    echo "	encode gzip"
    echo "	basic_auth {"
    echo "		$LOGIN"
    echo "	}"
    echo "	reverse_proxy app:8000 {"
    echo "		flush_interval -1"
    echo "	}"
    echo "}"
  } >> Caddyfile
fi

# Keep the tunnel on after updates and reboots.
if ! grep -q '^COMPOSE_PROFILES=.*tunnel' .env; then
  sed -i 's/^COMPOSE_PROFILES=\(.*\)$/COMPOSE_PROFILES=\1,tunnel/; s/^COMPOSE_PROFILES=,tunnel$/COMPOSE_PROFILES=tunnel/' .env
fi

$DC up -d
$DC restart caddy >/dev/null

echo "Waiting for the tunnel address..."
URL=""
for _ in $(seq 1 30); do
  URL="$($DC logs tunnel 2>&1 | grep -o 'https://[a-z0-9-]*\.trycloudflare\.com' | tail -1 || true)"
  [[ -n "$URL" ]] && break
  sleep 2
done

if [[ -z "$URL" ]]; then
  echo "No address yet. Look at: sudo docker compose logs tunnel"
  exit 1
fi
cat <<MSG

  Open:   $URL
  Login:  the same user and password as before

  This address changes if the server restarts. Run "bash deploy/tunnel.sh" again to see the new one.
MSG
