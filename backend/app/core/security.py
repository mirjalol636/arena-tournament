import hashlib
import secrets
from datetime import timedelta
import jwt
from fastapi import Depends, HTTPException, Request
from pwdlib import PasswordHash
from sqlalchemy import select
from app.core.config import settings
from app.db.session import get_db
from app.models.entities import User, RefreshToken, AdminUser, now

passwords = PasswordHash.recommended()
ROLES = {"SUPER_ADMIN", "ADMIN", "TOURNAMENT_MANAGER", "REFEREE", "PLAYER"}


def issue_tokens(db, user, response):
    access = jwt.encode(
        {"sub": str(user.id), "exp": now() + timedelta(minutes=15), "type": "access"},
        settings().jwt_secret,
        algorithm="HS256",
    )
    refresh = secrets.token_urlsafe(48)
    db.add(
        RefreshToken(
            user_id=user.id,
            digest=hashlib.sha256(refresh.encode()).hexdigest(),
            expires_at=now() + timedelta(days=14),
        )
    )
    db.commit()
    response.set_cookie(
        "arena_refresh",
        refresh,
        httponly=True,
        secure=settings().cookie_secure,
        samesite="strict",
        max_age=14 * 86400,
        path="/api/auth",
    )
    return {
        "access_token": access,
        "token_type": "bearer",
        "user": {
            "id": user.id,
            "email": user.email,
            "role": user.role,
            "nickname": user.player.nickname if user.player else "Organizer",
        },
    }


def current_user(request: Request, db=Depends(get_db)):
    token = request.headers.get("Authorization", "").removeprefix("Bearer ")
    try:
        payload = jwt.decode(token, settings().jwt_secret, algorithms=["HS256"], options={"require":["exp","sub","type"]})
        if payload.get("type") != "access":
            raise ValueError()
        user = db.get(User, int(payload["sub"]))
        if not user:
            raise ValueError()
        return user
    except (jwt.PyJWTError, ValueError, KeyError):
        raise HTTPException(401, "Please sign in to continue")


def staff(user=Depends(current_user)):
    if user.role == "PLAYER":
        raise HTTPException(403, "Organizer access required")
    return user


def authorize(db, user, tournament, referee=False):
    if user.role in {"SUPER_ADMIN", "ADMIN"}:
        return
    if user.role == "TOURNAMENT_MANAGER" and tournament.owner_id == user.id:
        return
    if (
        referee
        and user.role == "REFEREE"
        and db.scalar(
            select(AdminUser).where(
                AdminUser.user_id == user.id, AdminUser.tournament_id == tournament.id
            )
        )
    ):
        return
    raise HTTPException(403, "You do not have permission to manage this tournament")


def same_origin(request):
    origin = request.headers.get("origin")
    if origin and origin not in settings().cors_origins.split(","):
        raise HTTPException(403, "Origin not allowed")


def optional_user(request: Request, db=Depends(get_db)):
    return current_user(request,db) if request.headers.get('Authorization') else None
