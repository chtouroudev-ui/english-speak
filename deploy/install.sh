#!/usr/bin/env bash
# One-command setup for an Ubuntu server (tested target: Oracle Cloud free tier, ARM, 2 CPU, 12 GB RAM).
# Run from the project folder:   bash deploy/install.sh
# Options:
#   --domain my.domain.com    use your own domain (default: <your-ip>.sslip.io, free, no setup)
#   --model qwen2.5:3b        chat model to download into Ollama
#   --vision-model gemma3:4b  also download an image model (off by default: slow on a small CPU)
#   --external-llm URL        use a model server you already run (skips the Ollama container),
#                             e.g. http://host.docker.internal:11434/v1
#   --user NAME --password PW login for the web page (default user "me", random password)
set -euo pipefail

DOMAIN=""
LLM_MODEL="qwen2.5:3b"
VISION_MODEL=""
EXTERNAL_LLM=""
AUTH_USER="me"
AUTH_PASS=""

while [[ $# -gt 0 ]]; do
  case "$1" in
    --domain) DOMAIN="$2"; shift 2 ;;
    --model) LLM_MODEL="$2"; shift 2 ;;
    --vision-model) VISION_MODEL="$2"; shift 2 ;;
    --external-llm) EXTERNAL_LLM="$2"; shift 2 ;;
    --user) AUTH_USER="$2"; shift 2 ;;
    --password) AUTH_PASS="$2"; shift 2 ;;
    *) echo "Unknown option: $1"; exit 1 ;;
  esac
done

cd "$(dirname "$0")/.."
ROOT="$(pwd)"
say() { printf '\n\033[1;34m==> %s\033[0m\n' "$*"; }

[[ -f docker-compose.yml ]] || { echo "Run this from the project folder."; exit 1; }
SUDO=""; [[ $EUID -ne 0 ]] && SUDO="sudo"

# On a re-run without --domain/--password, keep the current web address and password.
KEEP_LOGIN=""
if [[ -f Caddyfile && -z "$DOMAIN" && -z "$AUTH_PASS" ]]; then
  KEEP_LOGIN=1
  DOMAIN="$(head -1 Caddyfile | cut -d' ' -f1)"
fi

say "Installing system packages"
export DEBIAN_FRONTEND=noninteractive
$SUDO apt-get update -y
echo iptables-persistent iptables-persistent/autosave_v4 boolean true | $SUDO debconf-set-selections
echo iptables-persistent iptables-persistent/autosave_v6 boolean true | $SUDO debconf-set-selections
$SUDO apt-get install -y curl ca-certificates git openssl iptables-persistent

if ! command -v docker >/dev/null 2>&1; then
  say "Installing Docker"
  curl -fsSL https://get.docker.com | $SUDO sh
  $SUDO usermod -aG docker "${SUDO_USER:-$USER}" || true
fi
$SUDO systemctl enable --now docker
DC="$SUDO docker compose"

if ! swapon --show | grep -q .; then
  say "Adding 4 GB swap (helps the first build on a small server)"
  $SUDO fallocate -l 4G /swapfile && $SUDO chmod 600 /swapfile && $SUDO mkswap /swapfile && $SUDO swapon /swapfile
  grep -q '^/swapfile' /etc/fstab || echo '/swapfile none swap sw 0 0' | $SUDO tee -a /etc/fstab >/dev/null
fi

say "Opening ports 80 and 443 in the server firewall"
# Oracle's Ubuntu images block everything except SSH with iptables rules.
for port in 80 443; do
  if ! $SUDO iptables -C INPUT -p tcp --dport "$port" -m state --state NEW -j ACCEPT 2>/dev/null; then
    $SUDO iptables -I INPUT -p tcp --dport "$port" -m state --state NEW -j ACCEPT
  fi
done
$SUDO iptables -C INPUT -p udp --dport 443 -j ACCEPT 2>/dev/null || $SUDO iptables -I INPUT -p udp --dport 443 -j ACCEPT
$SUDO netfilter-persistent save >/dev/null
if command -v ufw >/dev/null && $SUDO ufw status | grep -q active; then
  $SUDO ufw allow 80/tcp && $SUDO ufw allow 443
fi

if [[ -z "$DOMAIN" ]]; then
  IP="$(curl -fsS https://api.ipify.org || curl -fsS https://ifconfig.me)"
  DOMAIN="${IP//./-}.sslip.io"
fi

if [[ -z "$AUTH_PASS" && -z "$KEEP_LOGIN" ]]; then
  AUTH_PASS="$(openssl rand -base64 12 | tr -d '/+=' | cut -c1-12)"
fi

say "Writing settings (.env and Caddyfile)"
if [[ -n "$EXTERNAL_LLM" ]]; then
  PROFILES=""; BASE_URL="$EXTERNAL_LLM"
else
  PROFILES="ollama"; BASE_URL="http://ollama:11434/v1"
fi
cat > .env <<ENV
DOMAIN=$DOMAIN
COMPOSE_PROFILES=$PROFILES
LLM_BASE_URL=$BASE_URL
LLM_API=openai
LLM_MODEL=$LLM_MODEL
VISION_MODEL=$VISION_MODEL
VISION_ENABLED=$([[ -n "$VISION_MODEL" ]] && echo true || echo false)
WHISPER_MODEL=small.en
WHISPER_THREADS=2
ENV
if [[ -z "$KEEP_LOGIN" ]]; then
  HASH="$($SUDO docker run --rm caddy:2 caddy hash-password --plaintext "$AUTH_PASS")"
  sed -e "s|__DOMAIN__|$DOMAIN|" -e "s|__USER__|$AUTH_USER|" -e "s|__HASH__|$HASH|" Caddyfile.template > Caddyfile
fi

say "Building and starting the app (first build takes several minutes on 2 CPUs)"
$DC up -d --build

if [[ -z "$EXTERNAL_LLM" ]]; then
  say "Downloading the chat model: $LLM_MODEL"
  until $DC exec -T ollama ollama list >/dev/null 2>&1; do sleep 2; done
  $DC exec -T ollama ollama pull "$LLM_MODEL"
  if [[ -n "$VISION_MODEL" ]]; then
    say "Downloading the image model: $VISION_MODEL"
    $DC exec -T ollama ollama pull "$VISION_MODEL"
  fi
fi

say "Done!"
cat <<MSG

  Open:      https://$DOMAIN
$(if [[ -n "$KEEP_LOGIN" ]]; then echo "  Login:     unchanged (same user and password as before)"; else printf '  User:      %s\n  Password:  %s      (save it now, it is not shown again)' "$AUTH_USER" "$AUTH_PASS"; fi)

  If the page does not open, allow ports 80 and 443 in Oracle Cloud:
  Networking > Virtual Cloud Networks > your VCN > Security Lists > Default >
  Add Ingress Rules: Source 0.0.0.0/0, TCP, destination ports 80,443.

  Logs:      cd $ROOT && sudo docker compose logs -f
  Update:    cd $ROOT && git pull && sudo docker compose up -d --build
MSG
