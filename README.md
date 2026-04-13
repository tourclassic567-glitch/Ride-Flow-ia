# 🚗 Ride-Flow IA

An AI-powered ridesharing platform MVP built with Node.js + Express (backend) and React (frontend).

---

## Architecture Overview

```
Client (React)  ──HTTP──►  Express API  ──SQL──►  PostgreSQL
      │                        │
      └────WebSocket───────────┘
```

| Layer     | Technology                        |
|-----------|-----------------------------------|
| Frontend  | React 18, Axios, WebSocket client |
| Backend   | Node.js, Express 4, ws            |
| Database  | PostgreSQL (via `pg` pool)        |
| Payments  | Stripe (test mode)                |
| Deploy    | Railway (backend) + Vercel (frontend) |

---

## Directory Structure

```
Ride-Flow-ia/
├── backend/              Node.js + Express API
│   ├── src/
│   │   ├── index.js      Entry point (HTTP + WebSocket server)
│   │   ├── app.js        Express app + routes
│   │   ├── db/           PostgreSQL pool
│   │   ├── routes/       ride.js, pricing.js
│   │   ├── middleware/   validate.js, errorHandler.js
│   │   ├── services/     matching.js, stripeService.js, websocket.js
│   │   └── migrations/   001_initial.sql
│   └── railway.toml
├── frontend/             React SPA
│   ├── src/
│   │   ├── App.js
│   │   ├── components/   Auth, Passenger, Driver
│   │   └── services/     api.js, websocket.js
│   └── vercel.json
└── database/
    └── schema.sql
```

---

## One-Command Server Install (Hetzner / Ubuntu 22.04)

Run this on a fresh Hetzner Cloud server (CX21 or larger, Ubuntu 22.04) as root.  
**Always review the script before executing it:**

```bash
# Download, review, then run
curl -fsSL https://raw.githubusercontent.com/tourclassic567-glitch/Ride-Flow-ia/main/install.sh -o install.sh
less install.sh          # review contents
sudo bash install.sh
```

Or, after cloning the repo:

```bash
sudo bash install.sh
```

The script automatically:
- Installs Node.js 20, PostgreSQL, Nginx, Fail2Ban, UFW
- Creates the database, applies the full schema, and seeds secrets
- Installs backend npm packages and starts the `ride-flow` systemd service
- Configures a reverse proxy on port 80

After it finishes, follow the printed instructions to add your Stripe key and enable HTTPS with Certbot.  
See [docs/SETUP_HETZNER.md](docs/SETUP_HETZNER.md) for the full step-by-step guide.

---

### Prerequisites
- Node.js ≥ 18
- npm ≥ 9
- PostgreSQL (optional – app runs in mock mode without it)

### Backend

```bash
cd backend
cp .env.example .env          # edit values as needed
npm install
npm run dev                   # starts on http://localhost:3001
```

### Frontend

```bash
cd frontend
cp .env.example .env          # REACT_APP_API_URL=http://localhost:3001
npm install
npm start                     # starts on http://localhost:3000
```

---

## API Documentation

### Health

| Method | Path      | Description          |
|--------|-----------|----------------------|
| GET    | /health   | Health check         |

**Response:** `{ "status": "ok", "version": "1.0.0" }`

---

### Rides  `/ride`

#### POST /ride/request
Request a new ride.

**Body:**
```json
{
  "passenger_id": 1,
  "pickup_location": "123 Main St",
  "dropoff_location": "456 Oak Ave"
}
```

**Response `201`:**
```json
{
  "ride_id": 42,
  "status": "requested",
  "pickup_location": "123 Main St",
  "dropoff_location": "456 Oak Ave",
  "estimated_price": 10.00,
  "created_at": "2024-01-01T00:00:00.000Z"
}
```

---

#### POST /ride/match
Match a ride with the nearest available driver.

**Body:** `{ "ride_id": 42 }`

**Response:**
```json
{
  "ride_id": 42,
  "driver_id": 1,
  "status": "matched",
  "estimated_arrival": "5 minutes"
}
```
Also broadcasts a WebSocket event: `{ "type": "RIDE_MATCHED", "ride_id": 42, "driver_id": 1 }`

---

#### GET /ride/:id
Get ride details.

---

### Pricing  `/pricing`

#### POST /pricing/calculate
Calculate dynamic pricing.

**Body:**
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
    "distance_estimate": 7.82,
    "price_per_mile": 1.50,
    "surge_multiplier": 1.35
  },
  "surge_active": true
}
```

---

## Environment Variables

### Backend (`backend/.env`)

| Variable           | Description                              | Default     |
|--------------------|------------------------------------------|-------------|
| `DATABASE_URL`     | PostgreSQL connection string             | (mock mode) |
| `STRIPE_SECRET_KEY`| Stripe secret key (test mode)            | (mock mode) |
| `PORT`             | HTTP server port                         | `3001`      |
| `NODE_ENV`         | Environment                              | development |

### Frontend (`frontend/.env`)

| Variable              | Description             | Default                  |
|-----------------------|-------------------------|--------------------------|
| `REACT_APP_API_URL`   | Backend base URL        | `http://localhost:3001`  |
| `REACT_APP_WS_URL`    | WebSocket URL           | `ws://localhost:3001`    |

---

## Production Domain

The application is live at **[https://wolfida.com](https://wolfida.com)**.

| Detail            | Value                                           |
|-------------------|-------------------------------------------------|
| Domain            | `wolfida.com`                                   |
| DNS Provider      | Namecheap                                       |
| Railway CNAME     | `function-bun-production-0f84.up.railway.app`   |

See [DOMAIN_CONFIG.md](DOMAIN_CONFIG.md) for full DNS and Railway setup instructions.

---

## Deployment

### Backend → Railway

1. Connect your GitHub repository to [Railway](https://railway.app)
2. Set environment variables in Railway dashboard
3. Railway auto-detects `railway.toml` and runs `npm start`

### Frontend → Vercel

1. Import repository to [Vercel](https://vercel.com)
2. Set root directory to `frontend`
3. Add env vars: `REACT_APP_API_URL` and `REACT_APP_WS_URL`
4. Deploy — `vercel.json` handles SPA routing

### Database

Run `database/schema.sql` against your PostgreSQL instance:
```bash
psql $DATABASE_URL -f database/schema.sql
```

---

## WebSocket Events

| Event          | Direction        | Payload                                   |
|----------------|------------------|-------------------------------------------|
| `RIDE_MATCHED` | Server → Client  | `{ type, ride_id, driver_id }`            |

---

## Mock Mode

The app runs gracefully without a database or Stripe key:
- **No `DATABASE_URL`**: all DB queries return `null`; routes return mock data
- **No `STRIPE_SECRET_KEY`**: payment intents return mock objects
- Frontend shows mock rides in the driver dashboard
