import time
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from app import database as db
from app.agents.pricing_agent import pricing_agent
from app.services.stripe_service import create_payment_intent, confirm_payment

router = APIRouter()


class RideRequest(BaseModel):
    passenger_id: int
    pickup_location: str
    dropoff_location: str


class RideMatch(BaseModel):
    ride_id: int


class RidePay(BaseModel):
    ride_id: int
    amount: float


class RidePayConfirm(BaseModel):
    ride_id: int
    payment_intent_id: str


@router.post("/request", status_code=201)
async def request_ride(payload: RideRequest):
    if not payload.pickup_location or not payload.dropoff_location:
        raise HTTPException(status_code=400, detail="pickup_location and dropoff_location are required")

    base_fare = 2.50
    estimated_miles = 5.0
    price_per_mile = 1.50
    estimated_price = round(base_fare + estimated_miles * price_per_mile, 2)

    row = await db.fetchrow(
        """INSERT INTO rides (passenger_id, pickup_location, dropoff_location, price, status)
           VALUES ($1, $2, $3, $4, 'requested')
           RETURNING id, status, pickup_location, dropoff_location, price, created_at""",
        payload.passenger_id, payload.pickup_location, payload.dropoff_location, estimated_price,
    )

    if row:
        return {
            "ride_id": row["id"],
            "status": row["status"],
            "pickup_location": row["pickup_location"],
            "dropoff_location": row["dropoff_location"],
            "estimated_price": float(row["price"]),
            "created_at": row["created_at"].isoformat() if row["created_at"] else None,
        }

    # Mock mode
    return {
        "ride_id": int(time.time()),
        "status": "requested",
        "pickup_location": payload.pickup_location,
        "dropoff_location": payload.dropoff_location,
        "estimated_price": estimated_price,
        "created_at": None,
    }


@router.post("/match")
async def match_ride(payload: RideMatch):
    # Find nearest available driver
    driver_row = await db.fetchrow(
        "SELECT id FROM drivers WHERE status = 'online' LIMIT 1"
    )
    driver_id = driver_row["id"] if driver_row else int(time.time())

    await db.execute(
        "UPDATE rides SET status = 'matched', driver_id = $1 WHERE id = $2",
        driver_id, payload.ride_id,
    )

    return {
        "ride_id": payload.ride_id,
        "driver_id": driver_id,
        "status": "matched",
        "estimated_arrival": "5 minutes",
    }


@router.get("/{ride_id}")
async def get_ride(ride_id: int):
    row = await db.fetchrow(
        """SELECT r.*, u.email AS passenger_email,
                  d.latitude AS driver_latitude, d.longitude AS driver_longitude,
                  d.status AS driver_status
           FROM rides r
           LEFT JOIN users u ON r.passenger_id = u.id
           LEFT JOIN drivers d ON r.driver_id = d.id
           WHERE r.id = $1""",
        ride_id,
    )

    if row:
        return dict(row)

    return {
        "id": ride_id,
        "passenger_id": 1,
        "driver_id": None,
        "status": "requested",
        "pickup_location": "123 Main St",
        "dropoff_location": "456 Oak Ave",
        "price": 10.00,
        "created_at": None,
        "completed_at": None,
    }


@router.post("/pay", status_code=201)
async def pay_ride(payload: RidePay):
    if payload.amount <= 0:
        raise HTTPException(status_code=400, detail="amount must be a positive number")

    intent = await create_payment_intent(payload.amount)

    try:
        await db.execute(
            """INSERT INTO payments (ride_id, amount, stripe_payment_id, status)
               VALUES ($1, $2, $3, 'pending')""",
            payload.ride_id, payload.amount, intent["id"],
        )
    except Exception as e:
        print(f"Could not persist payment record: {e}")

    return {
        "ride_id": payload.ride_id,
        "payment_intent_id": intent["id"],
        "client_secret": intent.get("client_secret"),
        "status": intent.get("status"),
    }


@router.post("/pay/confirm")
async def confirm_ride_payment(payload: RidePayConfirm):
    confirmed = await confirm_payment(payload.payment_intent_id)

    try:
        await db.execute(
            "UPDATE payments SET status = 'completed' WHERE ride_id = $1 AND stripe_payment_id = $2",
            payload.ride_id, payload.payment_intent_id,
        )
    except Exception as e:
        print(f"Could not update payment status: {e}")

    return {
        "ride_id": payload.ride_id,
        "payment_intent_id": confirmed["id"],
        "status": confirmed["status"],
    }
