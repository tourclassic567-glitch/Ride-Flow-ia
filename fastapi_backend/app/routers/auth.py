import hashlib
import os
import secrets
import time
from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel, EmailStr
from slowapi import Limiter
from slowapi.util import get_remote_address

from app import database as db

router = APIRouter()
limiter = Limiter(key_func=get_remote_address)


class LoginRequest(BaseModel):
    email: str
    password: str
    role: str = "passenger"


def _hash_password(password: str) -> str:
    salt = secrets.token_hex(16)
    key = hashlib.scrypt(password.encode(), salt=salt.encode(), n=16384, r=8, p=1, dklen=64)
    return f"{salt}:{key.hex()}"


def _verify_password(password: str, stored: str) -> bool:
    try:
        salt, key_hex = stored.split(":")
        key = hashlib.scrypt(password.encode(), salt=salt.encode(), n=16384, r=8, p=1, dklen=64)
        return secrets.compare_digest(key_hex, key.hex())
    except Exception:
        return False


@router.post("/login")
async def login(payload: LoginRequest):
    email = payload.email.strip().lower()
    if not email:
        raise HTTPException(status_code=400, detail="Email is required")
    if not payload.password or len(payload.password) < 6:
        raise HTTPException(status_code=400, detail="Password must be at least 6 characters")

    row = await db.fetchrow(
        "SELECT id, email, role, password_hash FROM users WHERE email = $1", email
    )

    if row:
        if not _verify_password(payload.password, row["password_hash"]):
            raise HTTPException(status_code=401, detail="Invalid email or password")
        return {"id": row["id"], "email": row["email"], "role": row["role"]}

    # Auto-register (MVP)
    password_hash = _hash_password(payload.password)
    new_row = await db.fetchrow(
        """INSERT INTO users (email, password_hash, role)
           VALUES ($1, $2, $3)
           ON CONFLICT (email) DO NOTHING
           RETURNING id, email, role""",
        email, password_hash, payload.role,
    )

    if new_row:
        return {"id": new_row["id"], "email": new_row["email"], "role": new_row["role"]}

    # Conflict: email exists but password wrong
    existing = await db.fetchrow(
        "SELECT id, email, role, password_hash FROM users WHERE email = $1", email
    )
    if existing:
        if not _verify_password(payload.password, existing["password_hash"]):
            raise HTTPException(status_code=401, detail="Invalid email or password")
        return {"id": existing["id"], "email": existing["email"], "role": existing["role"]}

    # Mock mode (DB unavailable)
    return {"id": int(time.time()), "email": email, "role": payload.role}
