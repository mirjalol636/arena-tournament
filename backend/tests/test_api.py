from datetime import timedelta
from sqlalchemy import select
from app.models.entities import *
from app.services.competition import generate_schedule, approve_registration
from app.schemas.contracts import Schedule
from app.core.security import passwords
from conftest import login


def test_auth_rotation_and_replay(client, db, field):
    owner, _ = field(2)
    headers = login(client, owner.email)
    assert client.get("/api/auth/me", headers=headers).status_code == 200
    original = client.cookies.get("arena_refresh")
    assert client.post("/api/auth/refresh").status_code == 200
    client.cookies.set("arena_refresh", original)
    assert client.post("/api/auth/refresh").status_code == 401


def test_refresh_csrf(client, field):
    owner, _ = field(2)
    login(client, owner.email)
    assert (
        client.post(
            "/api/auth/refresh", headers={"Origin": "https://attacker.test"}
        ).status_code
        == 403
    )


def test_anonymous_and_player_permissions(client, db, field):
    owner, t = field(2)
    assert client.get("/api/admin").status_code == 401
    p = t.participants[0].player
    headers = login(client, p.user.email)
    assert client.get("/api/admin", headers=headers).status_code == 403
    assert (
        client.post(
            f"/api/tournaments/{t.slug}/schedule", headers=headers, json={}
        ).status_code
        == 403
    )


def test_manager_scope(client, db, field):
    owner, t = field(2)
    manager = t.participants[0].player.user
    manager.role = "TOURNAMENT_MANAGER"
    db.commit()
    headers = login(client, manager.email)
    assert (
        client.post(
            f"/api/tournaments/{t.slug}/schedule", headers=headers, json={}
        ).status_code
        == 403
    )


def test_result_opponent_confirmation_and_dispute(client, db, field):
    owner, t = field(2)
    generate_schedule(db, t, Schedule())
    db.commit()
    m = db.scalar(select(Match).where(Match.tournament_id == t.id))
    home = login(client, m.home.player.user.email)
    away = login(client, m.away.player.user.email)
    response = client.post(
        f"/api/matches/{m.id}/results",
        headers=home,
        json={"home_score": 2, "away_score": 1},
    )
    assert response.status_code == 201, response.text
    rid = response.json()["id"]
    assert (
        client.patch(
            f"/api/results/{rid}", headers=home, json={"state": "confirmed"}
        ).status_code
        == 403
    )
    assert (
        client.patch(
            f"/api/results/{rid}", headers=away, json={"state": "disputed"}
        ).status_code
        == 200
    )
    assert (
        client.patch(
            f"/api/results/{rid}", headers=away, json={"state": "confirmed"}
        ).status_code
        == 409
    )
    admin = login(client, owner.email)
    assert (
        client.post(
            f"/api/matches/{m.id}/results",
            headers=admin,
            json={"home_score": 3, "away_score": 1},
        ).status_code
        == 201
    )
    assert m.status == "completed" and m.home_score == 3
    assert (
        client.post(
            f"/api/matches/{m.id}/results",
            headers=admin,
            json={"home_score": 0, "away_score": 4},
        ).status_code
        == 409
    )
    assert db.scalar(select(AuditLog.id).where(AuditLog.action == "dispute_result"))


def test_registration_limit_and_duplicate(client, db, field):
    owner, t = field(2)
    u = User(email="new@arena.test", password_hash=passwords.hash("Password2026!"))
    db.add(u)
    db.flush()
    db.add(
        Player(
            user_id=u.id,
            nickname="newplayer",
            full_name="New Player",
            game_ids={"efootball": "abc"},
        )
    )
    db.commit()
    h = login(client, u.email)
    r = client.post(f"/api/tournaments/{t.slug}/register", headers=h, json={})
    assert r.status_code == 201 and r.json()["status"] == "waitlist"
    assert (
        client.post(
            f"/api/tournaments/{t.slug}/register", headers=h, json={}
        ).status_code
        == 409
    )
    admin = login(client, owner.email)
    assert (
        client.patch(
            f"/api/registrations/{r.json()['id']}",
            headers=admin,
            json={"status": "approved"},
        ).status_code
        == 409
    )


def test_pubg_validation_and_totals(client, db, field):
    owner, t = field(4, "league", "pubg")
    generate_schedule(db, t, Schedule(pubg_rounds=2))
    db.commit()
    m = db.scalar(select(Match).where(Match.tournament_id == t.id))
    headers = login(client, owner.email)
    rows = [
        {"participant_id": p.id, "placement": i + 1, "kills": 3}
        for i, p in enumerate(t.participants)
    ]
    bad = [dict(r, placement=1) for r in rows]
    assert (
        client.put(
            f"/api/matches/{m.id}/pubg", headers=headers, json={"results": bad}
        ).status_code
        == 422
    )
    r = client.put(f"/api/matches/{m.id}/pubg", headers=headers, json={"results": rows})
    assert r.status_code == 200, r.text
    board = client.get(f"/api/leaderboard?slug={t.slug}").json()
    assert board[0]["points"] == 13 and board[0]["kill_points"] == 3
    assert (
        client.put(
            f"/api/matches/{m.id}/pubg", headers=headers, json={"results": rows}
        ).status_code
        == 409
    )
    assert (
        client.put(
            f"/api/tournaments/{t.slug}/scoring",
            headers=headers,
            json={"placement_points": {"1": 20}, "kill_points": 2},
        ).status_code
        == 409
    )


def test_public_detail_excludes_private_information(client, field):
    _, t = field(2)
    r = client.get(f"/api/tournaments/{t.slug}")
    assert r.status_code == 200
    assert (
        "password_hash" not in r.text
        and "telegram_id" not in r.text
        and "email" not in r.text
    )


def test_signup_cannot_choose_role(client):
    r = client.post(
        "/api/auth/signup",
        json={
            "email": "signup@arena.test",
            "password": "SecurePassword!",
            "nickname": "new_user",
            "full_name": "New User",
            "role": "SUPER_ADMIN",
        },
    )
    assert r.status_code == 201
    assert r.json()["user"]["role"] == "PLAYER"


def test_rate_limit(client):
    for _ in range(20):
        client.post(
            "/api/auth/login", json={"email": "no@arena.test", "password": "incorrect"}
        )
    assert (
        client.post(
            "/api/auth/login", json={"email": "no@arena.test", "password": "incorrect"}
        ).status_code
        == 429
    )
