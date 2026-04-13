# 🏗️ Technical Architecture

## Overview

Ride-Flow IA is a real-time ridesharing platform with an autonomous AI agent layer. The system is designed for horizontal scalability and self-healing operation.

---

## High-Level Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                          Clients                                │
│        React SPA (Vercel)  ·  Mobile Apps  ·  Third-Party APIs │
└───────────────────┬─────────────────────────────────────────────┘
                    │ HTTPS / WSS
┌───────────────────▼─────────────────────────────────────────────┐
│                     Nginx (TLS Termination)                     │
└───────────────────┬─────────────────────────────────────────────┘
                    │ HTTP (localhost:3001)
┌───────────────────▼─────────────────────────────────────────────┐
│                  Express API  (Node.js)                         │
│                                                                 │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │                 Middleware Stack                         │    │
│  │  CORS → JSON parser → Rate Limiter → Admin Auth         │    │
│  └─────────────────────────────────────────────────────────┘    │
│                                                                 │
│  Public Routes                Admin Routes (X-Admin-Key)        │
│  ├─ /health                   ├─ /api/v1/admin/health           │
│  ├─ /auth/*                   ├─ /api/v1/admin/metrics          │
│  ├─ /ride/*                   ├─ /api/v1/admin/agents           │
│  ├─ /pricing/*                └─ /api/v1/admin/scheduler/tasks  │
│  ├─ /bookings/*                                                 │
│  ├─ /agents/*               Service Routes                      │
│  └─ /api/v1/services/*      └─ ai/complete, data/process,       │
│                                hosting/plans, hosting/status    │
│                                                                 │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │               WebSocket Server (ws)                      │    │
│  └─────────────────────────────────────────────────────────┘    │
│                                                                 │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │              Autonomous Agent Fleet                      │    │
│  │  PricingAgent · MatchingAgent · MonitoringAgent          │    │
│  │  BackupAgent  · RevenueAgent  · CleanupAgent             │    │
│  │  SecurityAgent · ResourcesAgent · AnalyticsAgent         │    │
│  └─────────────────────────────────────────────────────────┘    │
└───────────────────┬─────────────────────────────────────────────┘
                    │ pg pool
┌───────────────────▼─────────────────────────────────────────────┐
│                     PostgreSQL 14+                              │
│  users · drivers · rides · payments · demand_metrics ·          │
│  bookings · agent_logs                                          │
└─────────────────────────────────────────────────────────────────┘
                    │ rsync / sftp
┌───────────────────▼─────────────────────────────────────────────┐
│              Hetzner Storage Box (Backups)                      │
└─────────────────────────────────────────────────────────────────┘
```

---

## Component Details

### Express API

| Layer | Technology |
|-------|------------|
| HTTP framework | Express 4 |
| Real-time | WebSocket (`ws` library) |
| Rate limiting | `express-rate-limit` — 100 req/min per IP |
| Admin auth | `X-Admin-Key` header, `crypto.timingSafeEqual` (anti-timing attacks) |
| Payments | Stripe Node.js SDK |
| Database | `pg` connection pool |

### Security Layers

| Layer | Mechanism |
|-------|-----------|
| Network | UFW — only ports 22, 80, 443 open |
| SSH | Fail2Ban — brute-force protection |
| API rate limiting | 100 req/min per IP (express-rate-limit) |
| Admin auth | API key, constant-time comparison |
| Auto-block | SecurityAgent blocks IPs after 10 auth failures |
| TLS | Certbot/Let's Encrypt, auto-renewed |

### Autonomous Agent Fleet

| Agent | Role | Interval |
|-------|------|----------|
| PricingAgent | Dynamic surge pricing | 30 s |
| MatchingAgent | Ride-driver matching | 15 s |
| MonitoringAgent | DB & memory health | 20 s |
| BackupAgent | pg_dump + log pruning | 6 h |
| RevenueAgent | Revenue KPIs & incentives | 5 min |
| CleanupAgent | Stale ride/driver cleanup | 1 h |
| SecurityAgent | Intrusion detection | 5 min |
| ResourcesAgent | CPU/RAM optimisation | 2 min |
| AnalyticsAgent | KPI reports & anomalies | 10 min |

### Database Schema (key tables)

| Table | Purpose |
|-------|---------|
| `users` | Passenger accounts |
| `drivers` | Driver profiles + status |
| `rides` | Ride lifecycle |
| `payments` | Stripe payment records |
| `demand_metrics` | Surge pricing data |
| `bookings` | Pre-scheduled trips |
| `agent_logs` | Audit trail for all agents |

---

## API Overview

### Public

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/health` | Health check |
| POST | `/auth/register` | User registration |
| POST | `/auth/login` | User login |
| POST | `/ride/request` | Request a ride |
| POST | `/ride/match` | Match ride with driver |
| GET | `/ride/:id` | Ride details |
| POST | `/pricing/calculate` | Dynamic price estimate |

### Services (`/api/v1/services/`)

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/ai/complete` | AI text completion |
| POST | `/data/process` | Data processing |
| GET | `/hosting/plans` | Available hosting plans |
| GET | `/hosting/status` | Hosting status |

### Admin (`/api/v1/admin/`) — requires `X-Admin-Key`

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/health` | All agent status |
| GET | `/metrics` | Real-time metrics |
| GET | `/agents` | Agent list |
| GET | `/scheduler/tasks` | Scheduled tasks |

---

## Deployment Topology

```
Hetzner CX21 (Ubuntu 22.04)
└─ systemd: rideflow.service
   └─ node src/index.js  (port 3001)
└─ Nginx (ports 80/443)
   └─ TLS via Certbot
└─ PostgreSQL 14
└─ UFW + Fail2Ban
└─ rsync → Hetzner Storage Box
```

Frontend is deployed separately on **Vercel** (static React SPA).

---

## Environment Variables

See `backend/.env.example` for the full list. Critical variables:

| Variable | Description |
|----------|-------------|
| `DATABASE_URL` | PostgreSQL connection string |
| `STRIPE_SECRET_KEY` | Stripe payments |
| `ADMIN_API_KEY` | Admin endpoint authentication |
| `PORT` | HTTP server port (default 3001) |
