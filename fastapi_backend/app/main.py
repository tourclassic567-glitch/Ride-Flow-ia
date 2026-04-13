"""
Ride-Flow IA — FastAPI Backend
Author  : LIORVYS GUARDIOLA
Code    : 7039
Server  : Hetzner VPS 204.168.234.151
"""
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager

from app.database import init_db, close_db
from app.config import settings
from app.routers import auth, ride, pricing, bookings, agents as agents_router
from app.agents.orchestrator import orchestrator


@asynccontextmanager
async def lifespan(app: FastAPI):
    await init_db()
    orchestrator.start()
    yield
    orchestrator.stop()
    await close_db()


app = FastAPI(
    title="Ride-Flow IA API",
    description="FastAPI backend for Ride-Flow IA — Author: LIORVYS GUARDIOLA | Code: 7039",
    version="2.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router, prefix="/auth", tags=["auth"])
app.include_router(ride.router, prefix="/ride", tags=["ride"])
app.include_router(pricing.router, prefix="/pricing", tags=["pricing"])
app.include_router(bookings.router, prefix="/bookings", tags=["bookings"])
app.include_router(agents_router.router, prefix="/agents", tags=["agents"])


@app.get("/health")
async def health():
    return {"status": "ok", "version": "2.0.0", "author": "LIORVYS GUARDIOLA", "code": 7039}
