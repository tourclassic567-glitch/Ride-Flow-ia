import random
from fastapi import APIRouter
from pydantic import BaseModel

from app.agents.pricing_agent import pricing_agent

router = APIRouter()


class PricingRequest(BaseModel):
    pickup_location: str
    dropoff_location: str
    ride_type: str = "standard"


@router.post("/calculate")
async def calculate_price(payload: PricingRequest):
    base_fare = 2.50
    price_per_mile = 1.50
    estimated_distance = round(random.uniform(2, 20), 2)
    surge_multiplier = pricing_agent.get_surge_multiplier()
    final_price = round((base_fare + estimated_distance * price_per_mile) * surge_multiplier, 2)

    return {
        "estimated_price": final_price,
        "currency": "USD",
        "breakdown": {
            "base_fare": base_fare,
            "distance_estimate": estimated_distance,
            "price_per_mile": price_per_mile,
            "surge_multiplier": surge_multiplier,
        },
        "surge_active": surge_multiplier > 1.2,
        "pickup_location": payload.pickup_location,
        "dropoff_location": payload.dropoff_location,
        "ride_type": payload.ride_type,
    }
