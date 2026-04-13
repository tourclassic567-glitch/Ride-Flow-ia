# 🤖 Autonomous Agents Documentation

Ride-Flow IA runs a fleet of autonomous agents that continuously monitor, optimise, and operate the platform without manual intervention.

All agents extend `BaseAgent` and are registered with the `AgentOrchestrator`.

---

## Architecture

```
AgentOrchestrator
├── PricingAgent       (every 30 s)
├── MatchingAgent      (every 15 s)
├── MonitoringAgent    (every 20 s)
├── BackupAgent        (every 6 h)
├── RevenueAgent       (every 5 min)
├── CleanupAgent       (every 1 h)
├── SecurityAgent      (every 5 min)
├── ResourcesAgent     (every 2 min)
└── AnalyticsAgent     (every 10 min)
```

Each agent lifecycle:

```
start() → tick() → tick() → … → stop()
         ↑ setInterval every intervalMs
```

Errors in `tick()` are caught and recorded in `stats.errors` — the agent keeps running.

---

## BaseAgent API

| Method / Property | Description |
|-------------------|-------------|
| `start()`         | Begins the tick loop |
| `stop()`          | Clears the interval |
| `tick()`          | Override in subclasses |
| `status()`        | Returns `{ name, running, intervalMs, stats }` |
| `stats.ticks`     | Number of successful ticks |
| `stats.errors`    | Number of failed ticks |
| `stats.lastTick`  | ISO timestamp of last successful tick |
| `stats.lastError` | Last error message (if any) |

---

## Agent Reference

### 🧠 AgentOrchestrator

**Role:** Single point of control. Starts/stops all agents as a cohesive fleet. Injects shared dependencies (WebSocket broadcast, DB pool). Exposes aggregated `status()` used by admin API.

**Key methods:**
- `start(deps)` — starts all agents (idempotent)
- `stop()` — graceful shutdown
- `status()` — returns orchestrator + all agent statuses + metrics snapshot

---

### 💰 RevenueAgent

**Role:** Revenue analytics, demand forecasting, and driver incentive suggestions.

**Interval:** 5 minutes (env: `REVENUE_INTERVAL_MS`)

**Tick work:**
1. Queries 24 h ride and payment totals.
2. Computes hourly demand trend from `demand_metrics`.
3. Detects low-demand hours and suggests driver bonuses (15% for hours below 50% avg demand).
4. Broadcasts `REVENUE_REPORT` WebSocket event.
5. Persists report in `agent_logs`.

**Public method:** `getLastReport()` — returns the most recent revenue report.

---

### 🔧 BackupAgent

**Role:** Automated database backup and log rotation.

**Interval:** 6 hours (env: `BACKUP_INTERVAL_MS`)

**Tick work:**
1. Runs `pg_dump` when `DATABASE_URL` is set and `pg_dump` is on `$PATH`; falls back to row-count snapshots.
2. Prunes `agent_logs` records older than `BACKUP_RETENTION_DAYS` (default 30).

**Env vars:** `BACKUP_DIR`, `BACKUP_RETENTION_DAYS`, `BACKUP_INTERVAL_MS`

---

### 🌿 ResourcesAgent

**Role:** CPU/RAM optimisation and auto-scaling hints.

**Interval:** 2 minutes (env: `RESOURCES_INTERVAL_MS`)

**Tick work:**
1. Samples RSS memory and CPU usage delta.
2. Triggers a Node.js GC hint (`global.gc()`) when memory exceeds threshold.
3. Sets `scaleHint = 'scale-up'` when either CPU or memory threshold is exceeded.
4. Broadcasts `RESOURCE_ALERT` and persists metrics in `agent_logs`.

**Env vars:** `MEMORY_THRESHOLD_MB` (default 512), `CPU_THRESHOLD_PCT` (default 80), `RESOURCES_INTERVAL_MS`

**Public method:** `getMetrics()` — returns `{ memRssMb, cpuPercent, scaleHint }`.

---

### 🛡️ SecurityAgent

**Role:** Intrusion detection and IP blocking.

**Interval:** 5 minutes (env: `SECURITY_INTERVAL_MS`)

**Tick work:**
1. Queries `agent_logs` for `auth_failure` events within the last `SECURITY_THREAT_WINDOW_MINUTES` (default 60).
2. Blocks IPs with ≥ 10 auth failures (in-memory set; integrate with UFW for OS-level blocking).
3. Broadcasts `SECURITY_ALERT` for newly blocked IPs.
4. Persists audit record in `agent_logs`.

**Env vars:** `SECURITY_INTERVAL_MS`, `SECURITY_THREAT_WINDOW_MINUTES`

**Public method:** `getSecurityStatus()` — returns `{ blockedIPCount, totalThreatsDetected, lastAuditAt }`.

---

### 📊 AnalyticsAgent

**Role:** KPI reporting and anomaly prediction.

**Interval:** 10 minutes (env: `ANALYTICS_INTERVAL_MS`)

**Tick work:**
1. Computes 24 h KPIs: total/completed/cancelled rides, avg revenue per ride.
2. Runs a 2σ anomaly detection on hourly demand data.
3. Broadcasts `ANALYTICS_UPDATE` event.
4. Persists snapshot in `agent_logs`.

**Public method:** `getLastSnapshot()` — returns the most recent analytics snapshot.

---

### 📈 PricingAgent

**Role:** AI-driven dynamic surge pricing.

**Interval:** 30 seconds

**Surge formula:**
- demand_ratio = pending_rides / max(online_drivers, 1)
- Piecewise curve: 1.0× at low demand, up to 2.5× cap at extreme demand.

**Public method:** `getSurgeMultiplier()` — returns the current multiplier.

---

### 🔗 MatchingAgent

**Role:** Matches ride requests with the nearest available driver.

---

### 🔍 MonitoringAgent

**Role:** DB health watchdog with self-recovery and memory alerts.

**Interval:** 20 seconds

**Public method:** `getMetrics()` — returns `{ dbLatencyMs, memRssMb, dbUp }`.

---

### 🧹 CleanupAgent

**Role:** Housekeeping — cancels stale rides, resets ghost drivers, prunes old metrics.

**Interval:** 1 hour

---

## Scheduled Tasks API

All agents that run on a schedule register their tasks with the `Scheduler` service. Retrieve the full task list via:

```
GET /api/v1/admin/scheduler/tasks
Header: X-Admin-Key: <your-admin-key>
```

---

## WebSocket Events

| Event              | Payload                                   | Emitted by        |
|--------------------|-------------------------------------------|-------------------|
| `SURGE_UPDATE`     | `{ surge_multiplier }`                    | PricingAgent      |
| `RIDE_MATCHED`     | `{ ride_id, driver_id }`                  | MatchingAgent     |
| `SYSTEM_ALERT`     | `{ severity, message }`                   | MonitoringAgent   |
| `REVENUE_REPORT`   | `{ report }`                              | RevenueAgent      |
| `SECURITY_ALERT`   | `{ threats, message }`                    | SecurityAgent     |
| `RESOURCE_ALERT`   | `{ alerts, metrics }`                     | ResourcesAgent    |
| `ANALYTICS_UPDATE` | `{ snapshot }`                            | AnalyticsAgent    |
