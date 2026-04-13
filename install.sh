#!/usr/bin/env bash
# ============================================================
#  Ride-Flow IA — One-command server installer
#  Tested on Ubuntu 22.04 (Hetzner CX21 or larger)
#
#  SECURITY NOTE: Always review a script before executing it as root.
#  Download and inspect before running:
#    curl -fsSL https://raw.githubusercontent.com/tourclassic567-glitch/Ride-Flow-ia/main/install.sh -o install.sh
#    less install.sh   # review it
#    sudo bash install.sh
# ============================================================
set -euo pipefail

APP_DIR="/opt/ride-flow"
SERVICE_NAME="ride-flow"
NODE_VERSION="20"
DB_NAME="rideflow"
DB_USER="rideflow_user"
REPO_URL="https://github.com/tourclassic567-glitch/Ride-Flow-ia.git"

# ── Colour helpers ──────────────────────────────────────────
RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; NC='\033[0m'
info()    { echo -e "${GREEN}[INFO]${NC} $*"; }
warn()    { echo -e "${YELLOW}[WARN]${NC} $*"; }
error()   { echo -e "${RED}[ERROR]${NC} $*"; exit 1; }

# ── Root check ──────────────────────────────────────────────
[[ $EUID -eq 0 ]] || error "Please run as root: sudo bash install.sh"

info "=== Ride-Flow IA installer starting ==="

# ── 1. System packages ──────────────────────────────────────
info "Updating system packages..."
export DEBIAN_FRONTEND=noninteractive
apt-get update -qq
apt-get upgrade -y -qq

info "Installing base dependencies..."
apt-get install -y -qq \
  git curl wget ufw fail2ban \
  postgresql postgresql-contrib \
  nginx certbot python3-certbot-nginx \
  rsync openssl

# ── 2. Node.js 20 ───────────────────────────────────────────
if ! node --version 2>/dev/null | grep -q "^v${NODE_VERSION}"; then
  info "Installing Node.js ${NODE_VERSION}..."
  # NOTE: This downloads a setup script from NodeSource and executes it.
  # Review the script at https://deb.nodesource.com/setup_20.x before proceeding.
  NODESOURCE_SCRIPT=$(mktemp)
  curl -fsSL "https://deb.nodesource.com/setup_${NODE_VERSION}.x" -o "${NODESOURCE_SCRIPT}"
  bash "${NODESOURCE_SCRIPT}"
  rm -f "${NODESOURCE_SCRIPT}"
  apt-get install -y -qq nodejs
fi
info "Node.js $(node --version) ready"

# ── 3. UFW Firewall ─────────────────────────────────────────
info "Configuring firewall..."
ufw --force reset > /dev/null
ufw default deny incoming > /dev/null
ufw default allow outgoing > /dev/null
ufw allow ssh       > /dev/null
ufw allow 80/tcp    > /dev/null
ufw allow 443/tcp   > /dev/null
echo "y" | ufw enable > /dev/null
info "Firewall enabled (ssh, 80, 443)"

# ── 4. Fail2Ban ─────────────────────────────────────────────
info "Configuring Fail2Ban..."
cat > /etc/fail2ban/jail.local <<'EOF'
[sshd]
enabled  = true
port     = ssh
maxretry = 5
bantime  = 3600
findtime = 600
EOF
systemctl enable fail2ban --quiet
systemctl restart fail2ban

# ── 5. PostgreSQL ───────────────────────────────────────────
info "Setting up PostgreSQL..."
systemctl enable postgresql --quiet
systemctl start postgresql

# Generate a secure random DB password if not already saved
SECRETS_FILE="/root/.ride-flow-secrets"
if [[ -f "$SECRETS_FILE" ]]; then
  # shellcheck source=/dev/null
  source "$SECRETS_FILE"
else
  DB_PASS=$(openssl rand -hex 20)
  ADMIN_KEY=$(openssl rand -hex 32)
  cat > "$SECRETS_FILE" <<EOF
DB_PASS=${DB_PASS}
ADMIN_KEY=${ADMIN_KEY}
EOF
  chmod 600 "$SECRETS_FILE"
fi

# Create DB role and database (idempotent)
sudo -u postgres psql -tc "SELECT 1 FROM pg_roles WHERE rolname='${DB_USER}'" | grep -q 1 || \
  sudo -u postgres psql -c "CREATE USER ${DB_USER} WITH PASSWORD '${DB_PASS}';"
sudo -u postgres psql -tc "SELECT 1 FROM pg_database WHERE datname='${DB_NAME}'" | grep -q 1 || \
  sudo -u postgres psql -c "CREATE DATABASE ${DB_NAME} OWNER ${DB_USER};"
sudo -u postgres psql -c "GRANT ALL PRIVILEGES ON DATABASE ${DB_NAME} TO ${DB_USER};" > /dev/null

DATABASE_URL="postgresql://${DB_USER}:${DB_PASS}@localhost/${DB_NAME}"

# ── 6. Clone / update repo ──────────────────────────────────
if [[ -d "${APP_DIR}/.git" ]]; then
  info "Updating existing repository..."
  git -C "${APP_DIR}" pull --ff-only
else
  info "Cloning repository to ${APP_DIR}..."
  git clone "${REPO_URL}" "${APP_DIR}"
fi

# ── 7. Apply database schema ────────────────────────────────
info "Applying database schema..."
PGPASSWORD="${DB_PASS}" psql -U "${DB_USER}" -h localhost "${DB_NAME}" \
  -f "${APP_DIR}/database/schema.sql" > /dev/null
info "Schema applied"

# ── 8. Backend dependencies ─────────────────────────────────
info "Installing backend npm packages..."
npm --prefix "${APP_DIR}/backend" install --omit=dev --silent

# ── 9. Write .env file ──────────────────────────────────────
ENV_FILE="${APP_DIR}/backend/.env"

# Preserve existing .env so user customisations (Stripe key, etc.) survive updates
if [[ ! -f "${ENV_FILE}" ]]; then
  info "Creating .env from template..."
  cat > "${ENV_FILE}" <<EOF
DATABASE_URL=${DATABASE_URL}
PORT=3001
NODE_ENV=production
ADMIN_KEY=${ADMIN_KEY}

# Add your live Stripe key below:
STRIPE_SECRET_KEY=

# Optional — Hetzner Storage Box backup:
# HETZNER_BACKUP_USER=u123456
# HETZNER_BACKUP_HOST=u123456.your-storagebox.de
BACKUP_DIR=/var/backups/ride-flow

# Agent tuning (defaults shown):
# MEMORY_THRESHOLD_MB=512
# SECURITY_MAX_FAILURES=10
# SECURITY_WINDOW_MINUTES=15
# SECURITY_BLOCK_MINUTES=60
# HIGH_MEM_MB=400
EOF
  chmod 600 "${ENV_FILE}"
  info ".env created at ${ENV_FILE}"
else
  warn ".env already exists — skipped (edit manually if needed)"
fi

mkdir -p /var/backups/ride-flow

# ── 10. systemd service ─────────────────────────────────────
info "Installing systemd service..."
cat > "/etc/systemd/system/${SERVICE_NAME}.service" <<EOF
[Unit]
Description=Ride-Flow IA Backend
After=network.target postgresql.service

[Service]
Type=simple
User=www-data
WorkingDirectory=${APP_DIR}/backend
ExecStart=/usr/bin/node src/index.js
Restart=always
RestartSec=10
EnvironmentFile=${APP_DIR}/backend/.env
StandardOutput=journal
StandardError=journal

[Install]
WantedBy=multi-user.target
EOF

chown -R www-data:www-data "${APP_DIR}"

systemctl daemon-reload
systemctl enable "${SERVICE_NAME}" --quiet
systemctl restart "${SERVICE_NAME}"
sleep 2

if systemctl is-active --quiet "${SERVICE_NAME}"; then
  info "Service ${SERVICE_NAME} is running"
else
  warn "Service failed to start — check: journalctl -u ${SERVICE_NAME} -n 50"
fi

# ── 11. Nginx reverse proxy ─────────────────────────────────
NGINX_CONF="/etc/nginx/sites-available/${SERVICE_NAME}"

if [[ ! -f "${NGINX_CONF}" ]]; then
  info "Creating Nginx config (HTTP, no TLS yet)..."
  cat > "${NGINX_CONF}" <<'EOF'
server {
    listen 80;
    server_name _;

    location / {
        proxy_pass         http://localhost:3001;
        proxy_http_version 1.1;
        proxy_set_header   Upgrade $http_upgrade;
        proxy_set_header   Connection "upgrade";
        proxy_set_header   Host $host;
        proxy_set_header   X-Real-IP $remote_addr;
        proxy_set_header   X-Forwarded-For $proxy_add_x_forwarded_for;
    }
}
EOF
  ln -sf "${NGINX_CONF}" /etc/nginx/sites-enabled/
  rm -f /etc/nginx/sites-enabled/default
  nginx -t && systemctl reload nginx
  info "Nginx configured (HTTP). Add TLS with: certbot --nginx -d your-domain.com"
else
  warn "Nginx config already exists — skipped"
fi

# ── 12. Summary ─────────────────────────────────────────────
echo ""
echo -e "${GREEN}============================================${NC}"
echo -e "${GREEN} Ride-Flow IA installed successfully!${NC}"
echo -e "${GREEN}============================================${NC}"
echo ""
echo "  App directory : ${APP_DIR}"
echo "  Service       : systemctl status ${SERVICE_NAME}"
echo "  Logs          : journalctl -u ${SERVICE_NAME} -f"
echo "  API health    : curl http://localhost:3001/health"
echo "  Agents status : curl http://localhost:3001/agents"
echo "  DB connection : postgresql://${DB_USER}:****@localhost/${DB_NAME}"
echo "  Credentials   : ${SECRETS_FILE} (chmod 600)"
echo ""
echo "  Secrets saved to: ${SECRETS_FILE}"
echo ""
echo "  Next steps:"
echo "    1. Edit ${ENV_FILE} and set STRIPE_SECRET_KEY"
echo "    2. Point your domain DNS A record to this server's IP"
echo "    3. Run: certbot --nginx -d api.yourdomain.com"
echo ""
