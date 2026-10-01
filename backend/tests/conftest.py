import os

os.environ["JWT_SECRET"] = "test-only-secret-with-more-than-32-characters"
os.environ["DATABASE_URL"] = "sqlite://"
os.environ["REDIS_URL"] = ""
os.environ["ENVIRONMENT"] = "development"
os.environ["COOKIE_SECURE"] = "false"
os.environ["TELEGRAM_BOT_TOKEN"] = ""
os.environ["BOT_API_SECRET"] = ""
import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import Session
from sqlalchemy.pool import StaticPool
from fastapi.testclient import TestClient
from app.db.session import Base, get_db
from app.models.entities import *
from app.main import app, local_limits
from app.core.security import passwords
from datetime import timedelta


@pytest.fixture
def db():
    engine = create_engine(
        "sqlite://", connect_args={"check_same_thread": False}, poolclass=StaticPool
    )
    Base.metadata.create_all(engine)
    with Session(engine, expire_on_commit=False) as session:
        session.add_all(
            [Game(slug="efootball", name="eFootball"), Game(slug="pubg", name="PUBG")]
        )
        session.commit()
        yield session
    engine.dispose()


@pytest.fixture
def client(db):
    app.dependency_overrides[get_db] = lambda: db
    local_limits.clear()
    with TestClient(app) as client:
        yield client
    app.dependency_overrides.clear()


@pytest.fixture
def field(db):
    def make(count=8, format="single_elimination", game="efootball"):
        owner = User(
            email=f"admin{len(db.new)}-{__import__('secrets').token_hex(3)}@arena.test",
            password_hash=passwords.hash("Password2026!"),
            role="ADMIN",
        )
        db.add(owner)
        db.flush()
        t = Tournament(
            name="Test Cup",
            slug=__import__("secrets").token_hex(5),
            game=game,
            format=format,
            mode="team" if game == "pubg" else "solo",
            max_participants=count,
            owner_id=owner.id,
            registration_start=now() - timedelta(days=1),
            registration_end=now() + timedelta(days=1),
            start_date=now() + timedelta(days=2),
        )
        db.add(t)
        db.flush()
        db.add(TournamentRule(tournament_id=t.id))
        for i in range(count):
            u = User(
                email=f"p{i}-{t.id}@arena.test",
                password_hash=passwords.hash("Password2026!"),
            )
            db.add(u)
            db.flush()
            p = Player(
                user_id=u.id,
                nickname=f"p{i}_{t.id}",
                full_name=f"Player {i}",
                game_ids={"efootball": "1234"},
            )
            db.add(p)
            db.flush()
            db.add(Participant(tournament_id=t.id, player_id=p.id, seed=i + 1))
        db.commit()
        db.refresh(t)
        return owner, t

    return make


def login(client, email):
    response = client.post(
        "/api/auth/login", json={"email": email, "password": "Password2026!"}
    )
    assert response.status_code == 200, response.text
    return {"Authorization": "Bearer " + response.json()["access_token"]}
