import time
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from app import database as db

router = APIRouter()


class BookingCreate(BaseModel):
    passenger_id: int
    pickup_location: str
    dropoff_location: str


class BookingAccept(BaseModel):
    driver_id: int | None = None


@router.post("/", status_code=201)
async def create_booking(payload: BookingCreate):
    row = await db.fetchrow(
        """INSERT INTO rides (passenger_id, pickup_location, dropoff_location, status)
           VALUES ($1, $2, $3, 'requested')
           RETURNING id, passenger_id, pickup_location, dropoff_location, status, created_at""",
        payload.passenger_id, payload.pickup_location, payload.dropoff_location,
    )

    if row:
        return {"message": "Booking created", "booking": dict(row)}

    return {
        "message": "Booking created",
        "booking": {
            "id": int(time.time()),
            "passenger_id": payload.passenger_id,
            "pickup_location": payload.pickup_location,
            "dropoff_location": payload.dropoff_location,
            "status": "requested",
        },
    }


@router.put("/{booking_id}/accept")
async def accept_booking(booking_id: int, payload: BookingAccept):
    row = await db.fetchrow(
        "UPDATE rides SET status = 'matched', driver_id = $1 WHERE id = $2 RETURNING id, status",
        payload.driver_id, booking_id,
    )

    if row:
        return {"message": f"Booking {booking_id} accepted", "booking": dict(row)}
    return {"message": f"Booking {booking_id} accepted"}


@router.put("/{booking_id}/reject")
async def reject_booking(booking_id: int):
    row = await db.fetchrow(
        "UPDATE rides SET status = 'cancelled' WHERE id = $1 RETURNING id, status",
        booking_id,
    )

    if row:
        return {"message": f"Booking {booking_id} rejected", "booking": dict(row)}
    return {"message": f"Booking {booking_id} rejected"}


@router.get("/pending")
async def pending_bookings():
    rows = await db.fetch(
        """SELECT id, passenger_id, driver_id, pickup_location, dropoff_location, status, created_at
           FROM rides WHERE status = 'requested' ORDER BY created_at DESC"""
    )

    if rows is not None:
        return {"message": "Retrieved pending bookings", "bookings": [dict(r) for r in rows]}
    return {"message": "Retrieved pending bookings", "bookings": []}
