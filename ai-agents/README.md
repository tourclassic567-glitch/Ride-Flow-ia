# 🤖 Ride-Flow IA – Python AI Agent System

Autonomous AI agent server for the Ride-Flow IA ridesharing platform.  
Self-sustaining, revenue-generating, and 99.9% autonomous.

---

## 📐 Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                     Ride-Flow IA Stack                          │
│                                                                 │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │              FastAPI  (port 8000)                        │   │
│  │  /health  /agents  /rides  /pricing  /payments  /metrics │   │
│  └───────────────────┬──────────────────────────────────────┘   │
│                      │                                          │
│  ┌───────────────────▼──────────────────────────────────────┐   │
│  │              AgentOrchestrator                           │   │
│  │                                                          │   │
│  │  ┌────────────┐  ┌─────────────┐  ┌──────────────────┐  │   │
│  │  │PricingAgent│  │MatchingAgent│  │ MonitoringAgent  │  │   │
│  │  └────────────┘  └─────────────┘  └──────────────────┘  │   │
│  │  ┌─────────────┐ ┌──────────────┐ ┌──────────────────┐  │   │
│  │  │RevenueAgent │ │AnalyticsAgent│ │  SecurityAgent   │  │   │
│  │  └─────────────┘ └──────────────┘ └──────────────────┘  │   │
│  └───────────────────┬──────────────────────────────────────┘   │
│                      │ Redis pub/sub                            │
│  ┌───────────────────▼────────┐  ┌──────────────────────────┐   │
│  │  Redis 7  (cache + queue)  │  │  PostgreSQL 16  (storage) │  │
│  └────────────────────────────┘  └──────────────────────────┘   │
│                                                                  │
│  ┌─────────────────┐   ┌──────────────────────────────────┐     │
│  │  Prometheus     │◄──│  /metrics  endpoint              │     │
│  └────────┬────────┘   └──────────────────────────────────┘     │
│           │                                                      │
│  ┌────────▼────────┐                                             │
│  │  Grafana        │  (pre-built dashboard)                      │
│  └─────────────────┘                                             │
└─────────────────────────────────────────────────────────────────┘
```

| Layer        | Technology                                  |
|--------------|---------------------------------------------|
| Agent Server | Python 3.11, FastAPI, Uvicorn               |
| AI / LLM     | LangChain, OpenAI GPT-4o-mini (optional)    |
| Database     | PostgreSQL 16 via SQLAlchemy asyncpg        |
| Cache/Queue  | Redis 7 (pub/sub + key-value cache)         |
| Payments     | Stripe (mock mode if key not set)           |
| Monitoring   | Prometheus + Grafana                        |
| Container    | Docker + Docker Compose                     |
| Deploy       | Hetzner VPS (one-command setup)             |

---

## 🤖 Agents

| Agent              | Interval | Responsibility                                      |
|--------------------|----------|-----------------------------------------------------|
| **PricingAgent**   | 60 s     | Dynamic surge pricing using LangChain + demand data |
| **MatchingAgent**  | 10 s     | AI-powered ride-to-driver matching                  |
| **MonitoringAgent**| 30 s     | Redis & database health checks; latency tracking    |
| **RevenueAgent**   | 300 s    | Revenue aggregation and KPI reporting               |
| **AnalyticsAgent** | 120 s    | Platform KPIs + LLM-generated insights              |
| **SecurityAgent**  | 60 s     | Brute-force, payment fraud, rate-limit detection    |

All agents inherit from `BaseAgent` which provides:
- Async tick loop with configurable interval
- Prometheus metrics (ticks, errors, duration)
- Redis pub/sub event emission
- Structured logging
- Graceful start/stop lifecycle

---

## 📋 Prerequisites

- Docker ≥ 24  
- Docker Compose plugin (`docker compose`)  
- (Optional) OpenAI API key for AI-powered agents  
- (Optional) Stripe keys for live payments  

---

## 🚀 Quick Start (Local)

```bash
# 1. Clone the repository
git clone https://github.com/tourclassic567-glitch/Ride-Flow-ia.git
cd Ride-Flow-ia/ai-agents

# 2. Create environment file
cp .env.example .env
# Edit .env — minimum required: change POSTGRES_PASSWORD, SECRET_KEY, ADMIN_API_KEY

# 3. Start the full stack
docker compose up -d

# 4. Open the API docs
open http://localhost:8000/docs

# 5. Check agent status
curl http://localhost:8000/agents/status
```

---

## 🖥️ One-Command Hetzner VPS Deploy

SSH into your VPS as root, then run:

```bash
curl -fsSL https://raw.githubusercontent.com/tourclassic567-glitch/Ride-Flow-ia/main/ai-agents/scripts/setup.sh | bash
```

The script will:
1. Install Docker and Git if missing
2. Clone the repository
3. Generate a `.env` with random secure passwords
4. Configure the UFW firewall
5. Build and start all Docker services
6. Print URLs and save credentials to `/root/ride-flow-credentials.txt`

### After deploy

| Service        | URL                              |
|----------------|----------------------------------|
| AI Agent API   | `http://YOUR_IP:8000`            |
| API Docs       | `http://YOUR_IP:8000/docs`       |
| Grafana        | `http://YOUR_IP:3000`            |
| Prometheus     | `http://YOUR_IP:9090`            |
| Node.js API    | `http://YOUR_IP:3001`            |

---

## ⚙️ Environment Variables

Copy `.env.example` to `.env` and set the values:

| Variable                     | Description                                       | Required |
|------------------------------|---------------------------------------------------|----------|
| `POSTGRES_USER`              | PostgreSQL username                               | ✅       |
| `POSTGRES_PASSWORD`          | PostgreSQL password                               | ✅       |
| `POSTGRES_DB`                | Database name                                     | ✅       |
| `DATABASE_URL`               | SQLAlchemy async connection URL                   | ✅       |
| `REDIS_URL`                  | Redis connection URL                              | ✅       |
| `SECRET_KEY`                 | JWT / HMAC secret (64 random chars)               | ✅       |
| `ADMIN_API_KEY`              | Key required for admin endpoints                  | ✅       |
| `OPENAI_API_KEY`             | OpenAI key (agents use rule-based fallback if not set) | ⬜  |
| `OPENAI_MODEL`               | OpenAI model (default: `gpt-4o-mini`)             | ⬜       |
| `STRIPE_SECRET_KEY`          | Stripe secret key (mock mode if not set)          | ⬜       |
| `STRIPE_WEBHOOK_SECRET`      | Stripe webhook signing secret                     | ⬜       |
| `GRAFANA_USER`               | Grafana admin username                            | ✅       |
| `GRAFANA_PASSWORD`           | Grafana admin password                            | ✅       |
| `PRICING_AGENT_INTERVAL`     | PricingAgent tick interval in seconds             | ⬜       |
| `MATCHING_AGENT_INTERVAL`    | MatchingAgent tick interval in seconds            | ⬜       |
| `MONITORING_AGENT_INTERVAL`  | MonitoringAgent tick interval in seconds          | ⬜       |
| `REVENUE_AGENT_INTERVAL`     | RevenueAgent tick interval in seconds             | ⬜       |
| `ANALYTICS_AGENT_INTERVAL`   | AnalyticsAgent tick interval in seconds           | ⬜       |
| `SECURITY_AGENT_INTERVAL`    | SecurityAgent tick interval in seconds            | ⬜       |

---

## 📡 API Endpoints

Full interactive documentation available at `http://localhost:8000/docs` (Swagger UI).

### Health

| Method | Path      | Description         |
|--------|-----------|---------------------|
| GET    | `/health` | Application health  |

### Agents

| Method | Path              | Description                           | Auth        |
|--------|-------------------|---------------------------------------|-------------|
| GET    | `/agents/status`  | All agents status + live metrics      | None        |
| POST   | `/agents/start`   | Start agent fleet                     | Admin key   |
| POST   | `/agents/stop`    | Stop agent fleet gracefully           | Admin key   |

Admin endpoints require header `x-admin-key: <ADMIN_API_KEY>`.

### Rides

| Method | Path              | Description                           |
|--------|-------------------|---------------------------------------|
| POST   | `/rides/request`  | Request a new ride                    |
| GET    | `/rides/{id}`     | Get ride details                      |
| POST   | `/rides/match`    | Check/trigger ride matching           |

**POST /rides/request body:**
```json
{
  "passenger_id": 1,
  "pickup_location": "123 Main St",
  "dropoff_location": "456 Oak Ave",
  "ride_type": "standard"
}
```

### Pricing

| Method | Path                  | Description               |
|--------|-----------------------|---------------------------|
| POST   | `/pricing/calculate`  | Calculate dynamic price   |

**POST /pricing/calculate body:**
```json
{
  "pickup_location": "123 Main St",
  "dropoff_location": "456 Oak Ave",
  "ride_type": "standard"
}
```

**Response:**
```json
{
  "estimated_price": 14.73,
  "currency": "USD",
  "breakdown": {
    "base_fare": 2.50,
    "distance_estimate_miles": 7.82,
    "price_per_mile": 1.50,
    "surge_multiplier": 1.35
  },
  "surge_active": true
}
```

### Payments

| Method | Path                      | Description                  |
|--------|---------------------------|------------------------------|
| POST   | `/payments/create-intent` | Create Stripe PaymentIntent  |
| POST   | `/payments/webhook`       | Stripe webhook receiver      |

### Metrics

| Method | Path       | Description              |
|--------|------------|--------------------------|
| GET    | `/metrics` | Prometheus scrape target |

---

## 📊 Monitoring

Grafana includes a pre-built **Ride-Flow IA Agent Dashboard** with:

- Agent tick rate and error rate
- Surge multiplier gauge
- Active drivers & passengers
- HTTP request rate and p95 latency
- Security events timeline
- Payment intent tracking

---

## 🔧 Useful Commands

```bash
# View all logs
docker compose logs -f

# View only agent logs
docker compose logs -f agents

# Restart agents service
docker compose restart agents

# Scale (if using multiple workers)
docker compose up -d --scale agents=2

# Stop everything
docker compose down

# Stop and remove volumes (full reset)
docker compose down -v

# Run database migration manually
docker compose exec postgres psql -U rideflow -d rideflow -f /docker-entrypoint-initdb.d/001_initial.sql
```

---

## 📁 Directory Structure

```
ai-agents/
├── app/
│   ├── main.py                     FastAPI app + lifespan
│   ├── config.py                   Pydantic settings from env
│   ├── database.py                 Async SQLAlchemy + PostgreSQL
│   ├── redis_client.py             Redis connection, pub/sub, cache
│   ├── agents/
│   │   ├── base_agent.py           Abstract BaseAgent
│   │   ├── pricing_agent.py        Dynamic surge pricing
│   │   ├── matching_agent.py       AI ride-to-driver matching
│   │   ├── monitoring_agent.py     Health checks
│   │   ├── revenue_agent.py        Revenue reporting
│   │   ├── analytics_agent.py      KPIs + LLM insights
│   │   ├── security_agent.py       Anomaly detection
│   │   └── orchestrator.py         Agent fleet manager
│   ├── api/
│   │   ├── schemas.py              Pydantic request/response models
│   │   └── routes/
│   │       ├── health.py
│   │       ├── agents.py
│   │       ├── rides.py
│   │       ├── pricing.py
│   │       └── payments.py
│   ├── services/
│   │   ├── metrics.py              Prometheus metric definitions
│   │   └── stripe_service.py       Stripe integration
│   └── utils/
│       └── logger.py               Structured logging (structlog)
├── migrations/
│   └── 001_initial.sql             PostgreSQL schema
├── monitoring/
│   ├── prometheus.yml              Prometheus scrape config
│   └── grafana/provisioning/       Grafana datasources + dashboards
├── scripts/
│   └── setup.sh                    One-command Hetzner VPS deploy
├── Dockerfile                      Python 3.11 slim image
├── docker-compose.yml              Full stack (8 services)
├── requirements.txt                Python dependencies
└── .env.example                    Environment template
```

---

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/my-agent`
3. Add your agent in `app/agents/` inheriting from `BaseAgent`
4. Register it in `app/agents/orchestrator.py`
5. Add any new API routes in `app/api/routes/`
6. Submit a pull request

---

## 📄 License

MIT – see [LICENSE](../LICENSE) for details.
