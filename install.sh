#!/usr/bin/env bash
# ============================================================
#  Ride-Flow IA — Auto-install script for Hetzner VPS
#  Author  : LIORVYS GUARDIOLA
#  Code    : 7039
#  Server  : Hetzner VPS IPv4 204.168.234.151
#            IPv6 2a01:4f9:c014:c708::/64
#  User    : root
#
#  Usage   : curl -fsSL https://raw.githubusercontent.com/<repo>/main/install.sh | bash
#            -OR-  bash install.sh
# ============================================================

set -euo pipefail

REPO_URL="https://github.com/tourclassic567-glitch/Ride-Flow-ia.git"
APP_DIR="/opt/rideflow"
COMPOSE_ENV="${APP_DIR}/.env"

RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; CYAN='\033[0;36m'; NC='\033[0m'

info()    { echo -e "${CYAN}[INFO]${NC} $*"; }
success() { echo -e "${GREEN}[OK]${NC}   $*"; }
warn()    { echo -e "${YELLOW}[WARN]${NC} $*"; }
err()     { echo -e "${RED}[ERROR]${NC} $*" >&2; exit 1; }

# ── Require root ────────────────────────────────────────────────────────────
[[ $EUID -ne 0 ]] && err "This script must be run as root (sudo or root user)."

info "============================================================"
info "  Ride-Flow IA — Hetzner VPS installer"
info "  Author : LIORVYS GUARDIOLA | Code : 7039"
info "============================================================"

# ── 1. Update system ─────────────────────────────────────────────────────────
info "Updating system packages..."
apt-get update -qq && apt-get upgrade -y -qq
success "System updated."

# ── 2. Install Docker ────────────────────────────────────────────────────────
if ! command -v docker &>/dev/null; then
    info "Installing Docker..."
    curl -fsSL https://get.docker.com | sh
    systemctl enable --now docker
    success "Docker installed."
else
    success "Docker already installed: $(docker --version)"
fi

# ── 3. Install Docker Compose plugin ────────────────────────────────────────
if ! docker compose version &>/dev/null 2>&1; then
    info "Installing Docker Compose plugin..."
    apt-get install -y -qq docker-compose-plugin
    success "Docker Compose plugin installed."
else
    success "Docker Compose available: $(docker compose version --short)"
fi

# ── 4. Install git ───────────────────────────────────────────────────────────
if ! command -v git &>/dev/null; then
    info "Installing git..."
    apt-get install -y -qq git
fi

# ── 5. Clone or update repository ───────────────────────────────────────────
if [ -d "${APP_DIR}/.git" ]; then
    info "Repository already cloned — pulling latest changes..."
    git -C "${APP_DIR}" pull --ff-only
else
    info "Cloning repository to ${APP_DIR}..."
    git clone "${REPO_URL}" "${APP_DIR}"
fi
success "Repository ready at ${APP_DIR}."

# ── 6. Configure environment ─────────────────────────────────────────────────
if [ ! -f "${COMPOSE_ENV}" ]; then
    info "Creating .env from .env.production template..."
    cp "${APP_DIR}/.env.production" "${COMPOSE_ENV}"

    # Generate a random DB password
    DB_PASS=$(tr -dc 'A-Za-z0-9!@#$%^&*' </dev/urandom 2>/dev/null | head -c 32 || echo "rideflow_$(date +%s)")
    sed -i "s/CHANGE_ME_strong_password_here/${DB_PASS}/g" "${COMPOSE_ENV}"

    warn "⚠  Please edit ${COMPOSE_ENV} and set your STRIPE_SECRET_KEY before going live."
else
    success ".env already exists — skipping generation."
fi

# ── 7. Open firewall ports ───────────────────────────────────────────────────
if command -v ufw &>/dev/null; then
    info "Configuring UFW firewall..."
    ufw allow 22/tcp   comment "SSH"    2>/dev/null || true
    ufw allow 80/tcp   comment "HTTP"   2>/dev/null || true
    ufw allow 443/tcp  comment "HTTPS"  2>/dev/null || true
    ufw --force enable 2>/dev/null || true
    success "UFW configured."
fi

# ── 8. Build & start all services ───────────────────────────────────────────
info "Building Docker images (this may take a few minutes)..."
cd "${APP_DIR}"
docker compose --env-file "${COMPOSE_ENV}" build --no-cache

info "Starting all services..."
docker compose --env-file "${COMPOSE_ENV}" up -d

success "All services started."
docker compose ps

# ── 9. Done ──────────────────────────────────────────────────────────────────
echo ""
echo -e "${GREEN}============================================================${NC}"
echo -e "${GREEN}  ✅  Ride-Flow IA is running!                              ${NC}"
echo -e "${GREEN}      Author : LIORVYS GUARDIOLA  |  Code : 7039           ${NC}"
echo -e "${GREEN}      URL    : http://204.168.234.151                       ${NC}"
echo -e "${GREEN}      API    : http://204.168.234.151/api/docs  (FastAPI)   ${NC}"
echo -e "${GREEN}============================================================${NC}"
echo ""
warn "Remember to set your STRIPE_SECRET_KEY in ${COMPOSE_ENV}"
