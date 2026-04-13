# 🏛️ Architecture – Ride-Flow IA

Technical deep-dive into the system design, data flows, and component interactions.

---

## High-Level Architecture

```
┌──────────────────────────────────────────────────────────────────┐
│                         Client Layer                             │
│                                                                  │
│   React SPA (Vercel)          WebSocket client                   │
│   • Passenger / Driver UI     • Real-time ride events            │
└───────────────────┬───────────────────────┬──────────────────────┘
                    │ HTTP/HTTPS            │ WS
                    ▼                       ▼
┌──────────────────────────────────────────────────────────────────┐
│                       Express API (Railway)                      │
│                                                                  │
│  /auth          /ride          /pricing       /bookings          │
│  /agents        /api/v1/services              /api/v1/admin      │
│                                                                  │
│  Middleware: CORS │ Rate Limit │ Admin Auth │ Error Handler       │
└────────────┬──────────────────────────────────────┬─────────────┘
             │ pg pool                               │
             ▼                                       ▼
┌───────────────────────┐            ┌───────────────────────────┐
│    PostgreSQL DB      │            │   Autonomous Agent Fleet  │
│                       │            │                           │
│  users                │            │  PricingAgent   (30s)     │
│  drivers              │◄───────────│  MatchingAgent  (15s)     │
│  rides                │            │  MonitoringAgent(20s)     │
│  payments             │            │  RevenueAgent   (5m)      │
│  demand_metrics       │            │  BackupAgent    (6h)      │
│  agent_logs           │            │  CleanupAgent   (1h)      │
└───────────────────────┘            │  SecurityAgent  (1m)      │
                                     │  AnalyticsAgent (10m)     │
                                     │  DevOpsAgent    (15m)     │
                                     │  ResourcesAgent (5m)      │
                                     └───────────────────────────┘
```

---

## Technology Stack

| Layer        | Technology                     | Purpose                              |
|--------------|--------------------------------|--------------------------------------|
| Frontend     | React 18, Axios, WebSocket     | SPA UI for passengers and drivers    |
| Backend      | Node.js 20, Express 4          | REST API + WebSocket server          |
| Database     | PostgreSQL (via `pg` pool)     | Persistent data store                |
| Real-time    | `ws` (WebSocket library)       | Live ride and pricing events         |
| Payments     | Stripe SDK                     | PaymentIntents, webhooks             |
| AI/LLM       | Configurable (mock by default) | Text completion, data analysis       |
| Deploy (API) | Railway                        | Auto-deploy from GitHub              |
| Deploy (SPA) | Vercel                         | Edge-cached static hosting           |
| Backup       | Hetzner Storage Box + rsync    | Offsite daily database backups       |

---

## Request Lifecycle

### Ride Request

```
POST /ride/request
  │
  ├─ validate.js middleware validates body
  ├─ PricingAgent.getSurgeMultiplier() → surge
  ├─ DB INSERT INTO rides
  ├─ Response 201 { ride_id, estimated_price, ... }
  │
  └─ (async) MatchingAgent.tick() runs every 15s
       ├─ SELECT unmatched rides
       ├─ Haversine score available drivers
       ├─ UPDATE rides SET status='matched', driver_id=...
       └─ WS broadcast RIDE_MATCHED
```

### Admin API Request

```
GET /api/v1/admin/health
  │
  ├─ globalRateLimiter (100 req/min per IP)
  ├─ adminAuth middleware
  │   ├─ isBlocked(ip)? → 403
  │   ├─ !ADMIN_KEY? → 503
  │   └─ timingSafeEqual(provided, ADMIN_KEY)? → 401 + recordFailure(ip)
  │
  └─ orchestrator.status() → JSON response
```

---

## Database Schema

See `database/schema.sql` for the canonical schema. Key tables:

| Table           | Description                                    |
|-----------------|------------------------------------------------|
| `users`         | Passengers and admin accounts                  |
| `drivers`       | Driver profiles with GPS coordinates           |
| `rides`         | Ride requests with status FSM                  |
| `payments`      | Stripe payment records per ride                |
| `demand_metrics`| Time-series demand/surge snapshots             |
| `agent_logs`    | Audit log for all agent activity               |

### Ride Status FSM

```
requested → matched → in_progress → completed
    │
    └──────────────────────────────► cancelled
```

---

## Security Architecture

### Authentication

| Layer          | Mechanism                                           |
|----------------|-----------------------------------------------------|
| User auth      | scrypt password hash (N=16384, r=8, p=1)            |
| Admin API      | `X-Admin-Key` header with `crypto.timingSafeEqual`  |
| WebSocket      | No auth (read-only broadcast; extend as needed)     |

### Rate Limiting

- **Global**: 100 requests/minute per IP (all routes)
- **Login**: 10 attempts per 15 minutes per IP

### IP Blocking

`SecurityAgent` maintains an in-memory block list:

1. Each failed admin auth call invokes `recordFailure(ip)`.
2. After 10 failures within 15 minutes, the IP is blocked for 60 minutes.
3. `adminAuth` middleware checks `isBlocked(ip)` on every request.
4. Block stats are broadcast via `SECURITY_ALERT` WebSocket events.

---

## Autonomous Agent Fleet

See [AGENTS.md](./AGENTS.md) for full per-agent documentation.

Agents share state through:
- **PostgreSQL** – persistent metrics and logs
- **In-memory singletons** – fast reads (e.g. `PricingAgent.getSurgeMultiplier()`)
- **WebSocket broadcast** – real-time events pushed to connected clients

---

## API Versioning

| Prefix          | Description                                        |
|-----------------|----------------------------------------------------|
| `/`             | Legacy routes (maintained for backwards compat)    |
| `/api/v1/`      | Versioned REST API (services, admin)               |

### v1 Services Endpoints

| Method | Path                             | Auth     | Description              |
|--------|----------------------------------|----------|--------------------------|
| POST   | `/api/v1/services/ai/complete`   | None     | AI text completion       |
| POST   | `/api/v1/services/data/process`  | None     | Data transformation      |
| GET    | `/api/v1/services/hosting/plans` | None     | Available hosting plans  |
| GET    | `/api/v1/services/hosting/status`| None     | Hosting service status   |

### v1 Admin Endpoints

| Method | Path                              | Auth         | Description              |
|--------|-----------------------------------|--------------|--------------------------|
| GET    | `/api/v1/admin/health`            | X-Admin-Key  | All agent health status  |
| GET    | `/api/v1/admin/metrics`           | X-Admin-Key  | Real-time metrics        |
| GET    | `/api/v1/admin/agents`            | X-Admin-Key  | Agent list with details  |
| GET    | `/api/v1/admin/scheduler/tasks`   | X-Admin-Key  | Scheduled task registry  |

---

## Deployment Topology

```
GitHub
  │
  ├─ push → Railway (backend)
  │           ├─ npm start → node src/index.js
  │           ├─ Env vars set in Railway dashboard
  │           └─ CNAME → function-bun-production-0f84.up.railway.app
  │
  └─ push → Vercel (frontend)
              ├─ npm run build → static bundle
              ├─ Env vars: REACT_APP_API_URL, REACT_APP_WS_URL
              └─ vercel.json handles SPA routing
```

---

## Scaling Considerations

| Bottleneck          | Current Approach          | Scale-Up Path                        |
|---------------------|---------------------------|--------------------------------------|
| Agent timers        | Single-process intervals  | Move to BullMQ / Redis job queue     |
| DB connections      | Single `pg` pool          | PgBouncer connection pooler          |
| WebSocket           | Single server broadcast   | Redis pub/sub + horizontal scaling   |
| AI completions      | Mock stub                 | OpenAI / Anthropic API integration   |
| Rate limiting       | In-process `express-rate-limit` | Redis-backed store for multi-instance |
