# 🤖 Agents Documentation

Ride-Flow IA ships an autonomous agent fleet that runs continuously in the background.
Each agent extends `BaseAgent` and implements a `tick()` method that executes on a
configurable interval.

---

## Agent Lifecycle

```
orchestrator.start()
  └─ agent.inject(deps)   ← inject shared dependencies (broadcast, db)
  └─ agent.start()        ← calls tick() immediately, then on schedule
       └─ agent._runTick()  ← catches errors, updates stats
  └─ agent.stop()         ← called on SIGTERM / SIGINT
```

---

## Agents

### 🧠 AgentOrchestrator

Single entry-point that starts/stops every agent as a cohesive fleet.

| Property      | Value           |
|---------------|-----------------|
| File          | `AgentOrchestrator.js` |
| Singleton     | Yes             |

**Key methods:**
- `start(deps)` – starts all agents; injects `{ broadcast }` for WebSocket support
- `stop()` – gracefully stops all agents
- `status()` – returns aggregated snapshot of all agents and their metrics

---

### 💰 RevenueAgent

Autonomous revenue analytics, demand forecasting, and driver incentive suggestions.

| Property      | Value                              |
|---------------|------------------------------------|
| File          | `RevenueAgent.js`                  |
| Default interval | 5 minutes (`REVENUE_INTERVAL_MS`) |

**Each tick:**
1. Calculates 24 h total revenue and ride counts.
2. Computes hourly demand trend from `demand_metrics`.
3. Identifies "dead zones" and suggests driver bonuses.
4. Broadcasts `REVENUE_REPORT` WebSocket event.
5. Persists report in `agent_logs`.

---

### 🔍 PricingAgent

AI-driven dynamic surge pricing that keeps the platform competitive.

| Property      | Value                              |
|---------------|------------------------------------|
| File          | `PricingAgent.js`                  |
| Default interval | 30 seconds                      |

**Each tick:**
1. Counts online drivers and pending ride requests.
2. Calculates demand ratio → surge multiplier (1.0× – 2.5×).
3. Stores snapshot in `demand_metrics`.
4. Broadcasts `SURGE_UPDATE` WebSocket event.

---

### 🚗 MatchingAgent

Intelligent driver-passenger matching using Haversine distance scoring.

| Property      | Value                              |
|---------------|------------------------------------|
| File          | `MatchingAgent.js`                 |
| Default interval | 15 seconds                      |

**Each tick:**
1. Fetches unmatched ride requests (older than 5 s to avoid race conditions).
2. Scores available online drivers by GPS proximity.
3. Updates `rides` and `drivers` tables.
4. Broadcasts `RIDE_MATCHED` WebSocket event.

---

### 📊 MonitoringAgent

24/7 system health watchdog with self-recovery.

| Property      | Value                              |
|---------------|------------------------------------|
| File          | `MonitoringAgent.js`               |
| Default interval | 20 seconds                      |

**Each tick:**
1. Checks DB connectivity and latency.
2. Checks process RSS memory against `MEMORY_THRESHOLD_MB` (default 512 MB).
3. Broadcasts `SYSTEM_ALERT` on anomalies.
4. Persists health record in `agent_logs`.

---

### 💾 BackupAgent

Automated database backup and log rotation.

| Property      | Value                              |
|---------------|------------------------------------|
| File          | `BackupAgent.js`                   |
| Default interval | 6 hours (`BACKUP_INTERVAL_MS`) |

**Each tick:**
1. Attempts `pg_dump` when `DATABASE_URL` is set.
2. Falls back to row-count snapshot when `pg_dump` is unavailable.
3. Prunes `agent_logs` older than `BACKUP_RETENTION_DAYS` (default 30).

---

### 🧹 CleanupAgent

Continuous resource management and database housekeeping.

| Property      | Value                              |
|---------------|------------------------------------|
| File          | `CleanupAgent.js`                  |
| Default interval | 1 hour (`CLEANUP_INTERVAL_MS`) |

**Each tick:**
1. Cancels rides stuck in `requested` state for > `STALE_RIDE_MINUTES` (default 30).
2. Resets drivers stuck in `on_ride` state for > `MAX_RIDE_HOURS` (default 6).
3. Deletes `demand_metrics` older than `METRICS_RETENTION_DAYS` (default 7).

---

### 🛡️ SecurityAgent

Dynamic firewall, intrusion detection, and security audits.

| Property      | Value                              |
|---------------|------------------------------------|
| File          | `SecurityAgent.js`                 |
| Default interval | 60 seconds (`SECURITY_INTERVAL_MS`) |

**Each tick:**
1. Reviews in-memory failed-auth counters per IP.
2. Blocks IPs exceeding `SECURITY_MAX_FAILURES` (default 10) within `SECURITY_WINDOW_MINUTES` (default 15 min).
3. Clears expired blocks after `SECURITY_BLOCK_MINUTES` (default 60 min).
4. Broadcasts `SECURITY_ALERT` WebSocket event on new blocks.

**Exported helpers (used by `adminAuth` middleware):**
- `recordFailure(ip)` – increments failure counter for an IP
- `isBlocked(ip)` – returns true when the IP is currently blocked

---

### 📈 AnalyticsAgent

Daily reports, anomaly detection, and live dashboard metrics.

| Property      | Value                              |
|---------------|------------------------------------|
| File          | `AnalyticsAgent.js`                |
| Default interval | 10 minutes (`ANALYTICS_INTERVAL_MS`) |

**Each tick:**
1. Computes 24 h ride KPIs (completed, pending, cancelled).
2. Calculates 24 h revenue.
3. Runs Z-score anomaly detection on surge multiplier history (threshold 2.5σ).
4. Broadcasts `ANALYTICS_UPDATE` WebSocket event.
5. Persists snapshot in `agent_logs`.

---

### 🔧 DevOpsAgent

Automated deployment health checks and Hetzner Storage Box backups.

| Property      | Value                              |
|---------------|------------------------------------|
| File          | `DevOpsAgent.js`                   |
| Default interval | 15 minutes (`DEVOPS_INTERVAL_MS`) |

**Each tick:**
1. Validates process uptime and memory.
2. Performs DB ping.
3. Rsyncs `BACKUP_DIR` to Hetzner Storage Box when `HETZNER_BACKUP_USER` and `HETZNER_BACKUP_HOST` are set.

**Environment variables:**
| Variable              | Description                        | Default                    |
|-----------------------|------------------------------------|----------------------------|
| `HETZNER_BACKUP_USER` | SSH username for Hetzner backup    | (disabled)                 |
| `HETZNER_BACKUP_HOST` | Hetzner Storage Box hostname       | (disabled)                 |
| `BACKUP_DIR`          | Local directory to back up         | `/tmp/ride-flow-backups`   |

---

### ⚡ ResourcesAgent

CPU/RAM optimisation, log cleanup, and auto-scaling hints.

| Property      | Value                              |
|---------------|------------------------------------|
| File          | `ResourcesAgent.js`                |
| Default interval | 5 minutes (`RESOURCES_INTERVAL_MS`) |

**Each tick:**
1. Samples RSS memory and event-loop lag.
2. Triggers Node.js GC hint when RSS exceeds `HIGH_MEM_MB` (default 400 MB).
3. Emits `SCALING_RECOMMENDATION` after 3 consecutive high-memory ticks.
4. Prunes `agent_logs` older than `RESOURCES_RETENTION_DAYS` (default 14 days).

---

## WebSocket Events

| Event                    | Source Agent       | Payload                                          |
|--------------------------|--------------------|--------------------------------------------------|
| `SURGE_UPDATE`           | PricingAgent       | `{ type, surge_multiplier }`                     |
| `RIDE_MATCHED`           | MatchingAgent      | `{ type, ride_id, driver_id, distance_miles }`   |
| `SYSTEM_ALERT`           | MonitoringAgent    | `{ type, severity, message }`                    |
| `REVENUE_REPORT`         | RevenueAgent       | `{ type, report }`                               |
| `SECURITY_ALERT`         | SecurityAgent      | `{ type, blocked[], blockedUntilMinutes }`       |
| `ANALYTICS_UPDATE`       | AnalyticsAgent     | `{ type, snapshot }`                             |
| `SCALING_RECOMMENDATION` | ResourcesAgent     | `{ type, recommendation, reason }`               |

---

## Environment Variables Reference

| Variable                  | Agent           | Default           |
|---------------------------|-----------------|-------------------|
| `REVENUE_INTERVAL_MS`     | RevenueAgent    | `300000` (5 min)  |
| `BACKUP_INTERVAL_MS`      | BackupAgent     | `21600000` (6 h)  |
| `BACKUP_RETENTION_DAYS`   | BackupAgent     | `30`              |
| `BACKUP_DIR`              | BackupAgent     | `/tmp/ride-flow-backups` |
| `CLEANUP_INTERVAL_MS`     | CleanupAgent    | `3600000` (1 h)   |
| `STALE_RIDE_MINUTES`      | CleanupAgent    | `30`              |
| `MAX_RIDE_HOURS`          | CleanupAgent    | `6`               |
| `METRICS_RETENTION_DAYS`  | CleanupAgent    | `7`               |
| `MEMORY_THRESHOLD_MB`     | MonitoringAgent | `512`             |
| `SECURITY_INTERVAL_MS`    | SecurityAgent   | `60000` (1 min)   |
| `SECURITY_MAX_FAILURES`   | SecurityAgent   | `10`              |
| `SECURITY_WINDOW_MINUTES` | SecurityAgent   | `15`              |
| `SECURITY_BLOCK_MINUTES`  | SecurityAgent   | `60`              |
| `ANALYTICS_INTERVAL_MS`   | AnalyticsAgent  | `600000` (10 min) |
| `DEVOPS_INTERVAL_MS`      | DevOpsAgent     | `900000` (15 min) |
| `HETZNER_BACKUP_USER`     | DevOpsAgent     | (disabled)        |
| `HETZNER_BACKUP_HOST`     | DevOpsAgent     | (disabled)        |
| `RESOURCES_INTERVAL_MS`   | ResourcesAgent  | `300000` (5 min)  |
| `HIGH_MEM_MB`             | ResourcesAgent  | `400`             |
| `RESOURCES_RETENTION_DAYS`| ResourcesAgent  | `14`              |
