#!/usr/bin/env bash
# scripts/setup-firewall.sh
# Configures UFW to allow only the ports required by Ride-Flow IA.
# Run as root on your Ubuntu/Debian server.
#
# Usage:
#   sudo bash scripts/setup-firewall.sh
#   sudo bash scripts/setup-firewall.sh --domain api.example.com   (optional, informational)

set -euo pipefail

APP_PORT="${APP_PORT:-3001}"

echo "==> Installing UFW (if needed)"
apt-get install -y ufw >/dev/null 2>&1 || true

echo "==> Resetting UFW to defaults"
ufw --force reset

echo "==> Setting default policies"
ufw default deny incoming
ufw default allow outgoing

echo "==> Allowing SSH (22)"
ufw allow 22/tcp comment 'SSH'

echo "==> Allowing HTTP (80) and HTTPS (443) for Let's Encrypt / reverse proxy"
ufw allow 80/tcp  comment 'HTTP / Let'\''s Encrypt challenge'
ufw allow 443/tcp comment 'HTTPS'

echo "==> Allowing backend application port ${APP_PORT}"
ufw allow "${APP_PORT}/tcp" comment 'Ride-Flow IA API'

echo "==> Enabling UFW"
ufw --force enable

echo "==> UFW status"
ufw status verbose
echo ""
echo "✅ Firewall configured. Only ports 22, 80, 443, and ${APP_PORT} are open."
