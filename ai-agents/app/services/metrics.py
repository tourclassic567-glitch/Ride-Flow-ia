"""Prometheus metrics definitions shared across the application."""
from prometheus_client import Counter, Gauge, Histogram, Summary

# ── Agent metrics ────────────────────────────────────────────────────────────
agent_ticks_total = Counter(
    "agent_ticks_total",
    "Total number of agent tick executions",
    ["agent_name"],
)

agent_errors_total = Counter(
    "agent_errors_total",
    "Total number of agent tick errors",
    ["agent_name"],
)

agent_tick_duration_seconds = Histogram(
    "agent_tick_duration_seconds",
    "Duration of each agent tick in seconds",
    ["agent_name"],
    buckets=[0.01, 0.05, 0.1, 0.5, 1.0, 5.0, 10.0, 30.0],
)

agent_running = Gauge(
    "agent_running",
    "Whether the agent is currently running (1=yes, 0=no)",
    ["agent_name"],
)

# ── Business metrics ─────────────────────────────────────────────────────────
rides_requested_total = Counter(
    "rides_requested_total",
    "Total ride requests received",
)

rides_matched_total = Counter(
    "rides_matched_total",
    "Total rides successfully matched",
)

rides_completed_total = Counter(
    "rides_completed_total",
    "Total rides completed",
)

revenue_total_usd = Gauge(
    "revenue_total_usd",
    "Total revenue collected in USD (cumulative)",
)

surge_multiplier = Gauge(
    "surge_multiplier",
    "Current dynamic pricing surge multiplier",
)

active_drivers = Gauge(
    "active_drivers",
    "Number of currently active drivers",
)

active_passengers = Gauge(
    "active_passengers",
    "Number of passengers awaiting a ride",
)

# ── System metrics ────────────────────────────────────────────────────────────
http_request_duration_seconds = Histogram(
    "http_request_duration_seconds",
    "HTTP request duration in seconds",
    ["method", "path", "status_code"],
    buckets=[0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1.0, 2.5, 5.0],
)

http_requests_total = Counter(
    "http_requests_total",
    "Total HTTP requests",
    ["method", "path", "status_code"],
)

payment_intents_total = Counter(
    "payment_intents_total",
    "Total Stripe payment intents created",
    ["status"],
)

security_events_total = Counter(
    "security_events_total",
    "Total security events detected",
    ["event_type"],
)
