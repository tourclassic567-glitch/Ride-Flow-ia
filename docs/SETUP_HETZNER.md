# 🏗️ Setup Guide – Hetzner Cloud + Storage Box

This guide walks you through deploying the Ride-Flow IA backend on a **Hetzner Cloud** VPS
with automated backups to a **Hetzner Storage Box**.

---

## Prerequisites

- Hetzner Cloud account — [console.hetzner.cloud](https://console.hetzner.cloud)
- Hetzner Storage Box (optional, for offsite backups)
- A domain name with DNS pointing to your server
- SSH key pair added to your Hetzner project

---

## 1 – Create a Hetzner Cloud Server

1. Log in to the Hetzner Cloud Console.
2. Click **+ New server**.
3. Choose:
   - **Location**: any region closest to your users (e.g. Nuremberg, Helsinki, Falkenstein)
   - **Image**: Ubuntu 22.04
   - **Type**: CX21 (2 vCPU, 4 GB RAM) or larger
   - **SSH Keys**: select your key
4. Click **Create & Buy now**.

Note down the server **IPv4 address** (e.g. `123.45.67.89`).

---

## 2 – Initial Server Setup

```bash
ssh root@<SERVER_IP>

# Update packages
apt update && apt upgrade -y

# Install Node.js 20 (LTS)
curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
apt install -y nodejs

# Install PostgreSQL
apt install -y postgresql postgresql-contrib

# Install useful tools
apt install -y git ufw fail2ban certbot rsync
```

---

## 3 – Configure UFW Firewall

```bash
ufw default deny incoming
ufw default allow outgoing
ufw allow ssh          # port 22
ufw allow 80/tcp       # HTTP
ufw allow 443/tcp      # HTTPS
ufw allow 3001/tcp     # API (restrict to your proxy IP if using Nginx/Caddy)
ufw enable
ufw status verbose
```

---

## 4 – Configure Fail2Ban (SSH brute-force protection)

```bash
cp /etc/fail2ban/jail.conf /etc/fail2ban/jail.local
```

Edit `/etc/fail2ban/jail.local`:

```ini
[sshd]
enabled  = true
port     = ssh
maxretry = 5
bantime  = 3600
findtime = 600
```

```bash
systemctl enable fail2ban
systemctl restart fail2ban
fail2ban-client status sshd
```

---

## 5 – PostgreSQL Setup

```bash
sudo -u postgres psql

CREATE DATABASE rideflow;
CREATE USER rideflow_user WITH PASSWORD 'your_secure_password';
GRANT ALL PRIVILEGES ON DATABASE rideflow TO rideflow_user;
\q
```

Apply the schema:

```bash
psql postgresql://rideflow_user:your_secure_password@localhost/rideflow \
  -f /path/to/Ride-Flow-ia/database/schema.sql
```

---

## 6 – Clone and Configure the Application

```bash
git clone https://github.com/your-org/Ride-Flow-ia.git /opt/ride-flow
cd /opt/ride-flow/backend

cp .env.example .env
nano .env
```

Minimum required variables:

```env
DATABASE_URL=postgresql://rideflow_user:your_secure_password@localhost/rideflow
PORT=3001
NODE_ENV=production
ADMIN_KEY=<generate with: openssl rand -hex 32>
STRIPE_SECRET_KEY=sk_live_...
```

Install dependencies and start:

```bash
npm install --omit=dev
node src/index.js
```

---

## 7 – Run as a systemd Service

Create `/etc/systemd/system/ride-flow.service`:

```ini
[Unit]
Description=Ride-Flow IA Backend
After=network.target postgresql.service

[Service]
Type=simple
User=www-data
WorkingDirectory=/opt/ride-flow/backend
ExecStart=/usr/bin/node src/index.js
Restart=always
RestartSec=10
EnvironmentFile=/opt/ride-flow/backend/.env

[Install]
WantedBy=multi-user.target
```

```bash
systemctl daemon-reload
systemctl enable ride-flow
systemctl start ride-flow
systemctl status ride-flow
```

---

## 8 – HTTPS with Certbot / Let's Encrypt

```bash
# Point your domain DNS A record to <SERVER_IP> first
certbot certonly --standalone -d api.yourdomain.com

# Auto-renew
systemctl enable certbot.timer
```

Use Nginx or Caddy as a reverse proxy that terminates TLS and forwards to port 3001.

### Nginx example (`/etc/nginx/sites-available/ride-flow`):

```nginx
server {
    listen 443 ssl http2;
    server_name api.yourdomain.com;

    ssl_certificate     /etc/letsencrypt/live/api.yourdomain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/api.yourdomain.com/privkey.pem;

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

server {
    listen 80;
    server_name api.yourdomain.com;
    return 301 https://$host$request_uri;
}
```

```bash
ln -s /etc/nginx/sites-available/ride-flow /etc/nginx/sites-enabled/
nginx -t && systemctl reload nginx
```

---

## 9 – Hetzner Storage Box Backup

### Create a Storage Box

1. In the Hetzner console, go to **Storage Boxes** → **Order**.
2. Choose a size (BX11 = 100 GB is sufficient for most deployments).
3. Note the **hostname** (e.g. `u123456.your-storagebox.de`) and **username**.

### Configure SSH Key Access

```bash
# Generate a dedicated backup key (no passphrase for automated backups)
ssh-keygen -t ed25519 -f ~/.ssh/hetzner_backup -N ""

# Add public key to Storage Box via Hetzner console or:
ssh-copy-id -i ~/.ssh/hetzner_backup.pub u123456@u123456.your-storagebox.de
```

### Configure the DevOpsAgent

Add to `/opt/ride-flow/backend/.env`:

```env
HETZNER_BACKUP_USER=u123456
HETZNER_BACKUP_HOST=u123456.your-storagebox.de
BACKUP_DIR=/tmp/ride-flow-backups
```

The `DevOpsAgent` will automatically rsync `BACKUP_DIR` to the Storage Box every 15 minutes.
`BackupAgent` writes pg_dump files to `BACKUP_DIR` every 6 hours.

---

## 10 – Environment Variable Quick Reference

| Variable              | Description                         |
|-----------------------|-------------------------------------|
| `DATABASE_URL`        | PostgreSQL connection string        |
| `PORT`                | HTTP server port (default: 3001)    |
| `NODE_ENV`            | `production` / `development`        |
| `ADMIN_KEY`           | Secret key for X-Admin-Key header   |
| `STRIPE_SECRET_KEY`   | Stripe live/test secret key         |
| `HETZNER_BACKUP_USER` | Hetzner Storage Box username        |
| `HETZNER_BACKUP_HOST` | Hetzner Storage Box hostname        |
| `BACKUP_DIR`          | Local backup staging directory      |
| `AI_MODEL`            | AI model name shown in API response |
| `HOSTING_REGION`      | Region shown in hosting status      |

---

## Troubleshooting

| Issue                          | Solution                                                     |
|--------------------------------|--------------------------------------------------------------|
| Port 3001 not accessible       | Check `ufw allow 3001/tcp` and firewall rules                |
| Database connection refused    | Verify `DATABASE_URL` and `postgresql` service is running    |
| Certbot fails                  | Ensure port 80 is open and DNS has propagated                |
| Hetzner backup SSH error       | Check Storage Box SSH key is added in Hetzner console        |
| High memory warnings           | Increase server size or lower `HIGH_MEM_MB`                  |
