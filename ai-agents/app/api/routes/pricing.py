"""Pricing endpoints."""
import random

from fastapi import APIRouter
from app.api.schemas import PriceCalculateBody, PriceCalculateResponse, PriceBreakdown
from app.agents.orchestrator import orchestrator
from app.redis_client import get_value

router = APIRouter(prefix="/pricing", tags=["Pricing"])

BASE_FARE = 2.50
PRICE_PER_MILE = 1.50


@router.post(
    "/calculate",
    response_model=PriceCalculateResponse,
    summary="Calculate dynamic ride price",
)
async def calculate_price(body: PriceCalculateBody):
    """
    Calculate estimated ride price based on demand, distance, and surge multiplier.
    """
    surge = orchestrator.pricing.get_current_multiplier()

    # Simulate distance estimate (in production: use Google Maps / OSRM)
    distance_miles = round(random.uniform(1.5, 15.0), 2)
    estimated_price = round((BASE_FARE + distance_miles * PRICE_PER_MILE) * surge, 2)

    return PriceCalculateResponse(
        estimated_price=estimated_price,
        breakdown=PriceBreakdown(
            base_fare=BASE_FARE,
            distance_estimate_miles=distance_miles,
            price_per_mile=PRICE_PER_MILE,
            surge_multiplier=surge,
        ),
        surge_active=surge > 1.0,
    )
