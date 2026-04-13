#!/usr/bin/env bash
# scripts/setup-https.sh
# Obtains a Let's Encrypt TLS certificate via Certbot (standalone mode)
# and writes an Nginx reverse-proxy config for Ride-Flow IA.
# Run as root on your Ubuntu/Debian server.
#
# Usage:
#   sudo DOMAIN=api.example.com EMAIL=admin@example.com bash scripts/setup-https.sh

set -euo pipefail

DOMAIN="${DOMAIN:?Set DOMAIN=your.domain.com}"
EMAIL="${EMAIL:?Set EMAIL=admin@example.com}"
APP_PORT="${APP_PORT:-3001}"

echo "==> Installing Certbot and Nginx"
apt-get install -y certbot nginx python3-certbot-nginx >/dev/null 2>&1

echo "==> Writing temporary Nginx config for ACME challenge"
cat > /etc/nginx/sites-available/ride-flow <<NGINX
server {
    listen 80;
    server_name ${DOMAIN};

    location / {
        proxy_pass         http://127.0.0.1:${APP_PORT};
        proxy_http_version 1.1;
        proxy_set_header   Upgrade \$http_upgrade;
        proxy_set_header   Connection 'upgrade';
        proxy_set_header   Host \$host;
        proxy_set_header   X-Real-IP \$remote_addr;
        proxy_set_header   X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header   X-Forwarded-Proto \$scheme;
        proxy_cache_bypass \$http_upgrade;
    }
}
NGINX

ln -sf /etc/nginx/sites-available/ride-flow /etc/nginx/sites-enabled/ride-flow
nginx -t
systemctl reload nginx

echo "==> Requesting Let's Encrypt certificate for ${DOMAIN}"
certbot --nginx \
  --non-interactive \
  --agree-tos \
  --email "${EMAIL}" \
  -d "${DOMAIN}"

echo "==> Setting up auto-renewal cron job"
(crontab -l 2>/dev/null; echo "0 3 * * * certbot renew --quiet && systemctl reload nginx") | crontab -

echo "==> Final Nginx config test"
nginx -t
systemctl reload nginx

echo ""
echo "✅ HTTPS configured for https://${DOMAIN}"
echo "   Certificate will auto-renew daily at 03:00."
