"""
Ride-Flow IA – Python AI Agent Server

FastAPI application with autonomous AI agents, Prometheus metrics,
PostgreSQL, and Redis.
"""
import time
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request, Response
from fastapi.middleware.cors import CORSMiddleware
from prometheus_client import generate_latest, CONTENT_TYPE_LATEST

from app.agents.orchestrator import orchestrator
from app.api.routes import agents, health, payments, pricing, rides
from app.config import get_settings
from app.database import close_db, init_db
from app.redis_client import close_redis
from app.services.metrics import http_request_duration_seconds, http_requests_total
from app.utils.logger import configure_logging, get_logger

configure_logging()
logger = get_logger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan: startup → yield → shutdown."""
    settings = get_settings()
    logger.info("app.starting", version=settings.app_version, env=settings.environment)

    # Initialise services
    try:
        await init_db()
    except Exception as exc:
        logger.warning("db.init_failed", error=str(exc))

    # Start agent fleet
    await orchestrator.start()
    logger.info("app.ready")

    yield

    # Shutdown
    logger.info("app.shutting_down")
    await orchestrator.stop()
    await close_db()
    await close_redis()
    logger.info("app.stopped")


settings = get_settings()

app = FastAPI(
    title=settings.app_name,
    version=settings.app_version,
    description=(
        "Autonomous AI Agent system for Ride-Flow IA. "
        "Manages dynamic pricing, ride matching, monitoring, revenue, "
        "analytics, and security – all autonomously."
    ),
    docs_url="/docs",
    redoc_url="/redoc",
    openapi_url="/openapi.json",
    lifespan=lifespan,
)

# ── Middleware ────────────────────────────────────────────────────────────────
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.middleware("http")
async def metrics_middleware(request: Request, call_next):
    start = time.perf_counter()
    response: Response = await call_next(request)
    elapsed = time.perf_counter() - start
    path = request.url.path
    method = request.method
    status = str(response.status_code)
    http_request_duration_seconds.labels(method=method, path=path, status_code=status).observe(elapsed)
    http_requests_total.labels(method=method, path=path, status_code=status).inc()
    return response


# ── Routes ────────────────────────────────────────────────────────────────────
app.include_router(health.router)
app.include_router(agents.router)
app.include_router(rides.router)
app.include_router(pricing.router)
app.include_router(payments.router)


@app.get("/metrics", include_in_schema=False)
async def prometheus_metrics():
    """Prometheus scrape endpoint."""
    return Response(content=generate_latest(), media_type=CONTENT_TYPE_LATEST)
