#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
# Ride-Flow IA – One-command VPS setup & deploy script
# Tested on Ubuntu 22.04 / Debian 12 (Hetzner Cloud)
#
# Usage:
#   curl -fsSL https://raw.githubusercontent.com/yourorg/Ride-Flow-ia/main/ai-agents/scripts/setup.sh | bash
#   OR
#   bash setup.sh
# ─────────────────────────────────────────────────────────────────────────────
set -euo pipefail

REPO_URL="${REPO_URL:-https://github.com/tourclassic567-glitch/Ride-Flow-ia.git}"
INSTALL_DIR="${INSTALL_DIR:-/opt/ride-flow-ia}"
BRANCH="${BRANCH:-main}"

RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; NC='\033[0m'

log()   { echo -e "${GREEN}[✔]${NC} $*"; }
warn()  { echo -e "${YELLOW}[!]${NC} $*"; }
error() { echo -e "${RED}[✘]${NC} $*" >&2; exit 1; }

require_root() {
  [[ $EUID -eq 0 ]] || error "Please run as root: sudo bash $0"
}

install_docker() {
  if command -v docker &>/dev/null; then
    log "Docker already installed: $(docker --version)"
    return
  fi
  log "Installing Docker..."
  apt-get update -qq
  apt-get install -y -qq ca-certificates curl gnupg lsb-release
  install -m 0755 -d /etc/apt/keyrings
  curl -fsSL https://download.docker.com/linux/ubuntu/gpg \
    | gpg --dearmor -o /etc/apt/keyrings/docker.gpg
  chmod a+r /etc/apt/keyrings/docker.gpg
  echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] \
    https://download.docker.com/linux/ubuntu $(lsb_release -cs) stable" \
    > /etc/apt/sources.list.d/docker.list
  apt-get update -qq
  apt-get install -y -qq docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
  systemctl enable --now docker
  log "Docker installed: $(docker --version)"
}

install_git() {
  if command -v git &>/dev/null; then return; fi
  apt-get install -y -qq git
}

clone_or_update() {
  if [[ -d "$INSTALL_DIR/.git" ]]; then
    log "Updating existing repo at $INSTALL_DIR"
    git -C "$INSTALL_DIR" fetch --all --prune
    git -C "$INSTALL_DIR" checkout "$BRANCH"
    git -C "$INSTALL_DIR" pull origin "$BRANCH"
  else
    log "Cloning repository to $INSTALL_DIR"
    git clone --branch "$BRANCH" "$REPO_URL" "$INSTALL_DIR"
  fi
}

configure_env() {
  ENV_FILE="$INSTALL_DIR/ai-agents/.env"
  if [[ -f "$ENV_FILE" ]]; then
    warn ".env already exists – skipping generation. Edit $ENV_FILE to update credentials."
    return
  fi
  log "Generating .env from .env.example"
  cp "$INSTALL_DIR/ai-agents/.env.example" "$ENV_FILE"

  # Generate random secrets
  SECRET_KEY=$(openssl rand -hex 32)
  ADMIN_KEY=$(openssl rand -hex 16)
  PG_PASS=$(openssl rand -hex 16)
  GRAFANA_PASS=$(openssl rand -hex 12)

  sed -i \
    -e "s|change_me_strong_password|$PG_PASS|g" \
    -e "s|replace_with_64_random_characters|$SECRET_KEY|g" \
    -e "s|replace_with_admin_key|$ADMIN_KEY|g" \
    -e "s|change_me_grafana_password|$GRAFANA_PASS|g" \
    "$ENV_FILE"

  log "Generated .env with random secrets"
  warn "OpenAI and Stripe keys are NOT set. Add them to $ENV_FILE to enable AI features."
  echo "  ADMIN_API_KEY=$ADMIN_KEY" | tee -a /root/ride-flow-credentials.txt
  echo "  GRAFANA_PASSWORD=$GRAFANA_PASS" | tee -a /root/ride-flow-credentials.txt
  log "Credentials saved to /root/ride-flow-credentials.txt"
}

setup_firewall() {
  if command -v ufw &>/dev/null; then
    log "Configuring UFW firewall..."
    ufw allow OpenSSH    2>/dev/null || true
    ufw allow 80/tcp     2>/dev/null || true
    ufw allow 443/tcp    2>/dev/null || true
    ufw allow 8000/tcp   2>/dev/null || true  # AI Agents API
    ufw allow 3001/tcp   2>/dev/null || true  # Node.js backend
    ufw allow 3000/tcp   2>/dev/null || true  # Grafana
    ufw allow 9090/tcp   2>/dev/null || true  # Prometheus
    ufw --force enable   2>/dev/null || true
    log "Firewall configured"
  fi
}

deploy() {
  cd "$INSTALL_DIR/ai-agents"
  log "Building and starting all services..."
  docker compose pull --quiet
  docker compose build --parallel
  docker compose up -d --remove-orphans
  log "Waiting for services to be healthy..."
  sleep 10
  docker compose ps
}

print_summary() {
  SERVER_IP=$(curl -s ifconfig.me 2>/dev/null || echo "YOUR_SERVER_IP")
  echo ""
  echo -e "${GREEN}═══════════════════════════════════════════════════${NC}"
  echo -e "${GREEN}  Ride-Flow IA deployed successfully! 🚗🤖          ${NC}"
  echo -e "${GREEN}═══════════════════════════════════════════════════${NC}"
  echo ""
  echo "  🔗 API (AI Agents):  http://$SERVER_IP:8000"
  echo "  📚 API Docs:         http://$SERVER_IP:8000/docs"
  echo "  🔗 Node.js Backend:  http://$SERVER_IP:3001"
  echo "  📊 Grafana:          http://$SERVER_IP:3000"
  echo "  📈 Prometheus:       http://$SERVER_IP:9090"
  echo ""
  echo "  📂 Install dir:  $INSTALL_DIR/ai-agents"
  echo "  🔑 Credentials:  /root/ride-flow-credentials.txt"
  echo ""
  echo "  To view logs:    docker compose -f $INSTALL_DIR/ai-agents/docker-compose.yml logs -f"
  echo "  To stop:         docker compose -f $INSTALL_DIR/ai-agents/docker-compose.yml down"
  echo ""
}

main() {
  require_root
  install_git
  install_docker
  clone_or_update
  configure_env
  setup_firewall
  deploy
  print_summary
}

main "$@"
