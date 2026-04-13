"""Pydantic request/response schemas for the API."""
from __future__ import annotations

from typing import Any, Optional
from pydantic import BaseModel, Field


# ── Health ────────────────────────────────────────────────────────────────────
class HealthResponse(BaseModel):
    status: str
    version: str
    environment: str


# ── Agents ────────────────────────────────────────────────────────────────────
class AgentStats(BaseModel):
    ticks: int
    errors: int
    last_tick: Optional[str] = None
    last_error: Optional[str] = None
    started_at: Optional[str] = None


class AgentStatus(BaseModel):
    name: str
    running: bool
    interval_seconds: int
    stats: AgentStats


class OrchestratorStatus(BaseModel):
    started: bool
    agent_count: int


class AgentsStatusResponse(BaseModel):
    orchestrator: OrchestratorStatus
    agents: list[AgentStatus]
    metrics: dict[str, Any]


# ── Rides ─────────────────────────────────────────────────────────────────────
class RideRequestBody(BaseModel):
    passenger_id: int
    pickup_location: str = Field(..., min_length=1)
    dropoff_location: str = Field(..., min_length=1)
    ride_type: str = "standard"


class RideResponse(BaseModel):
    ride_id: int
    status: str
    pickup_location: str
    dropoff_location: str
    estimated_price: float
    surge_multiplier: float
    currency: str = "USD"
    created_at: str


class RideMatchBody(BaseModel):
    ride_id: int


class RideMatchResponse(BaseModel):
    ride_id: int
    driver_id: Optional[int] = None
    status: str
    estimated_arrival_minutes: Optional[int] = None
    matched_at: Optional[str] = None


# ── Pricing ───────────────────────────────────────────────────────────────────
class PriceCalculateBody(BaseModel):
    pickup_location: str
    dropoff_location: str
    ride_type: str = "standard"


class PriceBreakdown(BaseModel):
    base_fare: float
    distance_estimate_miles: float
    price_per_mile: float
    surge_multiplier: float


class PriceCalculateResponse(BaseModel):
    estimated_price: float
    currency: str = "USD"
    breakdown: PriceBreakdown
    surge_active: bool


# ── Payments ──────────────────────────────────────────────────────────────────
class CreatePaymentBody(BaseModel):
    ride_id: int
    amount_usd: float = Field(..., gt=0)
    currency: str = "usd"


class PaymentResponse(BaseModel):
    payment_intent_id: str
    client_secret: Optional[str] = None
    status: str
    amount_usd: float
    mock: bool = False
