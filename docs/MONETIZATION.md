# 💰 Monetization Guide

This document describes how Ride-Flow IA handles billing, payments, and revenue
optimisation through Stripe and the autonomous agent fleet.

---

## Overview

```
Passenger requests ride
       │
       ▼
PricingAgent calculates dynamic fare
       │
       ▼
Ride completed → Stripe PaymentIntent created
       │
       ▼
RevenueAgent analyses trends → suggests driver incentives
       │
       ▼
Analytics dashboard shows revenue KPIs
```

---

## Stripe Integration

### Setup

1. Create a [Stripe account](https://stripe.com).
2. Obtain your **Secret Key** from the Stripe Dashboard → Developers → API keys.
3. Add to your backend `.env`:

```env
STRIPE_SECRET_KEY=sk_live_...   # or sk_test_... for development
```

The app automatically falls back to **mock mode** when `STRIPE_SECRET_KEY` is absent.

### Payment Flow

| Step | Action                                        | Stripe Object         |
|------|-----------------------------------------------|-----------------------|
| 1    | Ride fare calculated by `PricingAgent`        | —                     |
| 2    | `POST /bookings/:id/pay` called by client     | `PaymentIntent`       |
| 3    | Client confirms payment using Stripe.js       | `PaymentIntent`       |
| 4    | Webhook `payment_intent.succeeded` received   | Webhook Event         |
| 5    | Ride marked `completed`, driver credited      | —                     |

### Webhooks

Configure a Stripe webhook endpoint pointing to your API:

```
https://api.yourdomain.com/bookings/webhook
```

Events to listen for:
- `payment_intent.succeeded`
- `payment_intent.payment_failed`
- `charge.refunded`

---

## Dynamic Pricing

The `PricingAgent` calculates a **surge multiplier** every 30 seconds based on supply/demand:

| Demand Ratio | Surge Multiplier  |
|--------------|-------------------|
| ≤ 0.5        | 1.0×              |
| 0.5 – 1.0    | 1.0× – 1.4×       |
| 1.0 – 2.0    | 1.4× – 2.0×       |
| > 2.0        | up to 2.5× (cap)  |

The multiplier is applied to the base fare when calculating `estimated_price`.

### Base Fare Structure

| Component         | Value (USD) |
|-------------------|-------------|
| Base fare         | $2.50       |
| Price per mile    | $1.50       |
| Surge multiplier  | 1.0× – 2.5× |

---

## Hosting Plans (SaaS Tier)

Ride-Flow IA exposes a white-label hosting tier via `/api/v1/services/hosting/plans`:

| Plan         | Price/month | vCPU | RAM  | Storage | Bandwidth |
|--------------|-------------|------|------|---------|-----------|
| Starter      | $9          | 1    | 2 GB | 20 GB   | 1 TB      |
| Professional | $29         | 2    | 8 GB | 80 GB   | 5 TB      |
| Enterprise   | $99         | 8    | 32 GB| 320 GB  | 20 TB     |

Manage plan upgrades through the Stripe **Billing Portal** or custom checkout flows.

---

## Revenue Analytics

The `RevenueAgent` generates automated revenue reports every 5 minutes:

- **Total revenue (24 h)** – sum of completed payments
- **Hourly demand trend** – average surge and pending rides per hour
- **Driver incentive suggestions** – 15% bonus for low-demand hours

Reports are broadcast via WebSocket (`REVENUE_REPORT`) and stored in `agent_logs`.

Access via admin API:

```http
GET /api/v1/admin/metrics
X-Admin-Key: <your_admin_key>
```

---

## Upselling Opportunities

1. **Surge alerts** – notify passengers of lower prices in 5–10 minutes (reduces churn)
2. **Subscription passes** – monthly flat-rate rides using Stripe Subscriptions
3. **Driver bonuses** – automated incentives during dead zones (handled by `RevenueAgent`)
4. **Priority matching** – premium tier with faster `MatchingAgent` priority queue
5. **Analytics API access** – sell dashboard access to fleet operators via API key billing

---

## Test Mode

All Stripe calls use **test mode** when `STRIPE_SECRET_KEY` starts with `sk_test_`.

Useful test card numbers:

| Scenario             | Card number         |
|----------------------|---------------------|
| Success              | `4242 4242 4242 4242`|
| Insufficient funds   | `4000 0000 0000 9995`|
| Authentication req.  | `4000 0025 0000 3155`|

Use any future expiry date, any 3-digit CVC, and any postal code.
