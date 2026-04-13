# 🛠️ Setup Guide — Hetzner Cloud

This guide walks you through deploying Ride-Flow IA on a Hetzner Cloud VPS (CX21 or larger recommended).

---

## Prerequisites

| Requirement | Version |
|-------------|---------|
| Ubuntu      | 22.04 LTS |
| Node.js     | ≥ 18 |
| npm         | ≥ 9 |
| PostgreSQL  | 14+ |

---

## 1 — Provision a Hetzner Server

1. Log in to [Hetzner Cloud Console](https://console.hetzner.cloud).
2. Create a new project and add a server:
   - **Location**: Falkenstein or Nuremberg
   - **Image**: Ubuntu 22.04
   - **Type**: CX21 (2 vCPU, 4 GB RAM) minimum
   - **SSH Key**: add your public key
3. Note the public IPv4 address.

---

## 2 — Initial Server Setup

```bash
# SSH into the server
ssh root@<SERVER_IP>

# Update packages
apt update && apt upgrade -y

# Install Node.js 18
curl -fsSL https://deb.nodesource.com/setup_18.x | bash -
apt install -y nodejs

# Install PostgreSQL
apt install -y postgresql postgresql-contrib

# Install Certbot for HTTPS
apt install -y certbot
```

---

## 3 — PostgreSQL Setup

```bash
sudo -u postgres psql <<EOF
CREATE USER rideflow WITH PASSWORD 'your_db_password';
CREATE DATABASE rideflow OWNER rideflow;
EOF

# Apply schema
psql postgresql://rideflow:your_db_password@localhost:5432/rideflow \
  -f /opt/ride-flow/database/schema.sql
```

---

## 4 — Application Deployment

```bash
# Clone repository
git clone https://github.com/tourclassic567-glitch/Ride-Flow-ia /opt/ride-flow
cd /opt/ride-flow/backend

# Install dependencies
npm install --production

# Configure environment
cp .env.example .env
nano .env   # fill in DATABASE_URL, STRIPE_SECRET_KEY, ADMIN_API_KEY, etc.
```

---

## 5 — Process Management (systemd)

Create `/etc/systemd/system/rideflow.service`:

```ini
[Unit]
Description=Ride-Flow IA Backend
After=network.target postgresql.service

[Service]
Type=simple
User=www-data
WorkingDirectory=/opt/ride-flow/backend
ExecStart=/usr/bin/node src/index.js
Restart=on-failure
RestartSec=5
EnvironmentFile=/opt/ride-flow/backend/.env

[Install]
WantedBy=multi-user.target
```

```bash
systemctl daemon-reload
systemctl enable --now rideflow
systemctl status rideflow
```

---

## 6 — Firewall (UFW)

```bash
ufw default deny incoming
ufw default allow outgoing
ufw allow ssh
ufw allow 80/tcp
ufw allow 443/tcp
# Internal API port — only allow from localhost / Nginx proxy
ufw allow from 127.0.0.1 to any port 3001
ufw enable
```

---

## 7 — HTTPS with Certbot

```bash
# Point your domain's A record to <SERVER_IP>, then:
certbot certonly --standalone -d yourdomain.com -d www.yourdomain.com

# Auto-renewal is handled by the certbot systemd timer (enabled by default)
```

Configure Nginx as a reverse proxy that terminates TLS and forwards to port 3001.

---

## 8 — Hetzner Storage Box Backups

1. Order a [Hetzner Storage Box](https://www.hetzner.com/storage/storage-box) (BX11 or larger).
2. Enable SFTP access in the Storage Box panel.
3. Set `BACKUP_DIR` in `.env` to a local staging directory.
4. Mount the Storage Box via SFTP or rsync; schedule daily transfers with cron:

```bash
# Example cron entry (daily at 03:00)
0 3 * * * rsync -avz /tmp/ride-flow-backups/ user@your-storage-box.your-storagebox.de:backups/
```

---

## 9 — Fail2Ban (SSH Brute-Force Protection)

```bash
apt install -y fail2ban
systemctl enable --now fail2ban
```

The default jail protects SSH. For additional Node.js rate-limit integration, the `SecurityAgent` blocks IPs at the application level after 10 consecutive auth failures.

---

## Environment Variables Reference

| Variable              | Description                         | Required |
|-----------------------|-------------------------------------|----------|
| `DATABASE_URL`        | PostgreSQL connection string        | Yes      |
| `STRIPE_SECRET_KEY`   | Stripe secret key                   | Yes      |
| `ADMIN_API_KEY`       | Secret key for `/api/v1/admin` routes | Yes    |
| `PORT`                | HTTP server port (default: 3001)    | No       |
| `NODE_ENV`            | `production` in live environments   | No       |
| `BACKUP_DIR`          | Local directory for pg_dump files   | No       |
| `MEMORY_THRESHOLD_MB` | RSS alert threshold (default: 512)  | No       |
