"""Simple password authentication with JWT for NETRUNNER."""

import os
from datetime import datetime, timedelta, timezone

import jwt
from fastapi import HTTPException, Security
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

SECRET_KEY = os.environ.get("NETRUNNER_JWT_SECRET", "netrunner-dev-secret-change-me-in-production!!")
PASSWORD = os.environ.get("NETRUNNER_PASSWORD", "netrunner")
ALGORITHM = "HS256"
TOKEN_EXPIRE_HOURS = 72

security = HTTPBearer()


def create_token() -> str:
    """Create a JWT token."""
    payload = {
        "sub": "player",
        "exp": datetime.now(timezone.utc) + timedelta(hours=TOKEN_EXPIRE_HOURS),
        "iat": datetime.now(timezone.utc),
    }
    return jwt.encode(payload, SECRET_KEY, algorithm=ALGORITHM)


def verify_password(password: str) -> bool:
    return password == PASSWORD


def verify_token(credentials: HTTPAuthorizationCredentials = Security(security)) -> str:
    """FastAPI dependency to verify JWT token."""
    try:
        payload = jwt.decode(credentials.credentials, SECRET_KEY, algorithms=[ALGORITHM])
        return payload["sub"]
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token abgelaufen")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Ungültiger Token")
