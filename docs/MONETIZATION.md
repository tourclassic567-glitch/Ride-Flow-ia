# 💰 Monetization Guide

This document explains how Ride-Flow IA generates revenue and how to configure each monetization channel.

---

## Revenue Streams

| Stream | Description |
|--------|-------------|
| Per-Ride Commission | Platform takes a percentage of each completed ride |
| Dynamic Surge Pricing | Higher multipliers during peak demand |
| Hosting Plans | Monthly SaaS plans for white-label deployments |
| Driver Incentives (Upsell) | Bonus programmes that increase driver retention |

---

## 1 — Per-Ride Commission

Configure the commission rate via the `PLATFORM_COMMISSION_PCT` environment variable (default: 20%).

The `RevenueAgent` calculates and logs daily totals. Access via:

```
GET /api/v1/admin/metrics
Header: X-Admin-Key: <your-admin-key>
```

---

## 2 — Dynamic Surge Pricing (Stripe Integration)

### Setup

1. Create a [Stripe](https://dashboard.stripe.com) account.
2. Obtain your **secret key** (use test mode during development).
3. Set `STRIPE_SECRET_KEY` in `backend/.env`.

### Payment Flow

```
POST /ride/request  →  PricingAgent calculates surge
                    →  POST /pricing/calculate returns estimated_price
                    →  Stripe Payment Intent created at checkout
                    →  Webhook confirms payment → ride marked completed
```

### Stripe Webhook

Configure a webhook in the Stripe dashboard pointing to:
```
https://yourdomain.com/payments/webhook
```

Set `STRIPE_WEBHOOK_SECRET` in `.env` to the signing secret.

### Test Cards

| Scenario | Card Number |
|----------|-------------|
| Success  | 4242 4242 4242 4242 |
| Decline  | 4000 0000 0000 0002 |
| 3DS Auth | 4000 0025 0000 3155 |

---

## 3 — Hosting Plans

Three tiers are exposed via the public API:

```
GET /api/v1/services/hosting/plans
```

| Plan       | Price/month | Key Features                          |
|------------|-------------|---------------------------------------|
| Starter    | $9.99       | 1 vCPU, 1 GB RAM, 20 GB SSD          |
| Pro        | $29.99      | 2 vCPU, 4 GB RAM, 80 GB SSD, scaling |
| Enterprise | $99.99      | 8 vCPU, 16 GB RAM, 320 GB SSD, support |

To bill for plans, create Stripe Products and Prices in the dashboard, then update the plan IDs in `backend/src/routes/services.js` to reference the Stripe Price IDs.

---

## 4 — Driver Incentive Upselling

The `RevenueAgent` automatically detects low-demand hours and generates `incentiveSuggestions` (15% driver bonus). Surface these in the driver dashboard to:

- Increase driver availability during off-peak hours.
- Improve ride fulfillment rate (reducing lost revenue from unmatched requests).

Incentive suggestions are included in the `REVENUE_REPORT` WebSocket event and the `GET /api/v1/admin/metrics` response.

---

## 5 — Pricing Configuration

| Env Variable            | Default | Description                          |
|-------------------------|---------|--------------------------------------|
| `PLATFORM_COMMISSION_PCT` | 20    | Commission percentage per ride       |
| `SURGE_MAX_MULTIPLIER`  | 2.5     | Maximum surge cap                    |
| `REVENUE_INTERVAL_MS`   | 300000  | Revenue report interval (ms)         |

---

## 6 — Financial Reports

Daily revenue reports are persisted in `agent_logs` with `event_type = 'revenue_report'`. Query them directly from PostgreSQL for custom dashboards or export to BI tools:

```sql
SELECT
  created_at,
  payload->>'totalRevenue' AS total_revenue,
  payload->>'totalRides'   AS total_rides
FROM agent_logs
WHERE agent_name = 'RevenueAgent'
  AND event_type = 'revenue_report'
ORDER BY created_at DESC
LIMIT 30;
```
