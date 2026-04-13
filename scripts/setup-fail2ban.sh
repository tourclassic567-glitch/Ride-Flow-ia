#!/usr/bin/env bash
# scripts/setup-fail2ban.sh
# Installs and configures Fail2Ban to protect SSH and the Ride-Flow IA API
# against brute-force attacks.
# Run as root on your Ubuntu/Debian server.
#
# Usage:
#   sudo bash scripts/setup-fail2ban.sh

set -euo pipefail

APP_PORT="${APP_PORT:-3001}"
APP_LOG="${APP_LOG:-/var/log/ride-flow/access.log}"

echo "==> Installing Fail2Ban"
apt-get install -y fail2ban >/dev/null 2>&1

echo "==> Writing /etc/fail2ban/jail.local"
cat > /etc/fail2ban/jail.local <<EOF
[DEFAULT]
bantime  = 86400        ; 24 hours
findtime = 900          ; 15-minute rolling window
maxretry = 10           ; block after 10 failures
banaction = ufw

[sshd]
enabled  = true
port     = ssh
logpath  = %(sshd_log)s
backend  = %(sshd_backend)s

[ride-flow-api]
enabled  = true
port     = ${APP_PORT}
filter   = ride-flow-api
logpath  = ${APP_LOG}
maxretry = 10
findtime = 900
bantime  = 86400
EOF

echo "==> Writing /etc/fail2ban/filter.d/ride-flow-api.conf"
mkdir -p /etc/fail2ban/filter.d
cat > /etc/fail2ban/filter.d/ride-flow-api.conf <<'FILTER'
[Definition]
# Match lines logged by the Ride-Flow IA backend for failed auth attempts.
# Example log line produced by Morgan / custom logger:
#   2024-01-15T12:00:00.000Z AUTH_FAILURE ip=203.0.113.42 email=x@example.com
failregex = AUTH_FAILURE ip=<HOST>
ignoreregex =
FILTER

echo "==> Restarting Fail2Ban"
systemctl enable fail2ban
systemctl restart fail2ban

echo "==> Fail2Ban status"
fail2ban-client status
echo ""
echo "✅ Fail2Ban configured. SSH and API brute-force protection active."
