"""Ride request and status endpoints."""
import time
import random

from fastapi import APIRouter, HTTPException
from app.api.schemas import (
    RideRequestBody,
    RideResponse,
    RideMatchBody,
    RideMatchResponse,
)
from app.agents.orchestrator import orchestrator
from app.redis_client import get_value, set_value, get_redis
from app.services.metrics import rides_requested_total
import json

router = APIRouter(prefix="/rides", tags=["Rides"])


@router.post(
    "/request",
    response_model=RideResponse,
    status_code=201,
    summary="Request a new ride",
)
async def request_ride(body: RideRequestBody):
    """Create a new ride request and enqueue it for matching."""
    surge = orchestrator.pricing.get_current_multiplier()
    base_fare = 2.50
    distance = round(random.uniform(1.5, 15.0), 2)
    estimated_price = round((base_fare + distance * 1.50) * surge, 2)

    ride_id = random.randint(10000, 99999)
    created_at = time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())

    ride = {
        "ride_id": ride_id,
        "passenger_id": body.passenger_id,
        "pickup_location": body.pickup_location,
        "dropoff_location": body.dropoff_location,
        "ride_type": body.ride_type,
        "status": "requested",
        "estimated_price": estimated_price,
        "surge_multiplier": surge,
        "created_at": created_at,
    }

    # Store ride and enqueue for MatchingAgent
    await set_value(f"ride:{ride_id}", ride, ttl=3600)
    r = await get_redis()
    await r.rpush("matching:pending_rides", json.dumps(ride))

    rides_requested_total.inc()

    return RideResponse(
        ride_id=ride_id,
        status="requested",
        pickup_location=body.pickup_location,
        dropoff_location=body.dropoff_location,
        estimated_price=estimated_price,
        surge_multiplier=surge,
        created_at=created_at,
    )


@router.get(
    "/{ride_id}",
    response_model=dict,
    summary="Get ride details",
)
async def get_ride(ride_id: int):
    """Retrieve stored ride data."""
    ride = await get_value(f"ride:{ride_id}")
    if not ride:
        raise HTTPException(status_code=404, detail="Ride not found")
    return ride


@router.post(
    "/match",
    response_model=RideMatchResponse,
    summary="Manually trigger ride matching",
)
async def match_ride(body: RideMatchBody):
    """Check if MatchingAgent has paired this ride with a driver."""
    result = await get_value(f"matching:result:{body.ride_id}")
    if result:
        return RideMatchResponse(
            ride_id=body.ride_id,
            driver_id=result.get("driver_id"),
            status="matched",
            estimated_arrival_minutes=result.get("estimated_arrival_minutes"),
            matched_at=result.get("matched_at"),
        )
    return RideMatchResponse(ride_id=body.ride_id, status="pending")
