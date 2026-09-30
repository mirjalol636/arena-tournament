import pytest
from datetime import timedelta
from fastapi import HTTPException
from sqlalchemy import select
from app.models.entities import *
from app.services.competition import generate_schedule, approve_registration, standings
from app.schemas.contracts import Schedule
from app.core.security import passwords
from conftest import login


def create_player_user(db, email, nickname, game_ids=None):
    u = User(email=email, password_hash=passwords.hash("Password2026!"))
    db.add(u)
    db.flush()
    p = Player(
        user_id=u.id,
        nickname=nickname,
        full_name=f"{nickname} Full",
        game_ids=game_ids or {"efootball": f"ef_{nickname}", "pubg": f"pubg_{nickname}"},
    )
    db.add(p)
    db.flush()
    return u, p


def test_solo_registration_and_admin_lifecycle(client, db, field):
    owner, t = field(2, "single_elimination", "efootball")
    # Increase max participants to allow new registration
    t.max_participants = 8
    db.commit()

    u, p = create_player_user(db, "solo_tester@arena.test", "soloplayer")
    db.commit()

    h = login(client, u.email)
    r = client.post(f"/api/tournaments/{t.slug}/register", headers=h, json={})
    assert r.status_code == 201
    assert r.json()["status"] == "pending"
    reg_id = r.json()["id"]

    # Check registration appears in admin
    admin_h = login(client, owner.email)
    regs = client.get("/api/registrations", headers=admin_h).json()
    our_reg = next(x for x in regs if x["id"] == reg_id)
    assert our_reg["name"] == "soloplayer"
    assert our_reg["status"] == "pending"
    assert our_reg["game"] == "efootball"
    assert our_reg["game_id"] == "ef_soloplayer"

    # Admin approves registration
    appr = client.patch(
        f"/api/registrations/{reg_id}",
        headers=admin_h,
        json={"status": "approved"},
    )
    assert appr.status_code == 200
    assert appr.json()["status"] == "approved"

    # Verify participant is now in tournament
    db.expire_all()
    t_refreshed = db.get(Tournament, t.id)
    assert any(part.player_id == p.id for part in t_refreshed.participants)
    assert len(t_refreshed.participants) == 3


def test_solo_registration_rejection_excludes_from_competition(client, db, field):
    owner, t = field(2, "single_elimination", "efootball")
    t.max_participants = 8
    db.commit()

    u, p = create_player_user(db, "rejected_solo@arena.test", "rejectedplayer")
    db.commit()

    h = login(client, u.email)
    r = client.post(f"/api/tournaments/{t.slug}/register", headers=h, json={})
    assert r.status_code == 201
    reg_id = r.json()["id"]

    admin_h = login(client, owner.email)
    rej = client.patch(
        f"/api/registrations/{reg_id}",
        headers=admin_h,
        json={"status": "rejected"},
    )
    assert rej.status_code == 200
    assert rej.json()["status"] == "rejected"

    db.expire_all()
    t_refreshed = db.get(Tournament, t.id)
    assert not any(part.player_id == p.id for part in t_refreshed.participants)
    assert len(t_refreshed.participants) == 2

    # Generate matches
    generate_schedule(db, t_refreshed, Schedule())
    db.commit()

    # Verify rejected player is in no match
    matches = list(db.scalars(select(Match).where(Match.tournament_id == t.id)))
    for m in matches:
        if m.home:
            assert m.home.player_id != p.id
        if m.away:
            assert m.away.player_id != p.id


def test_waitlist_and_promotion(client, db, field):
    owner, t = field(2, "single_elimination", "efootball")
    t.max_participants = 2
    db.commit()

    u, p = create_player_user(db, "waitlist_user@arena.test", "waitlistplayer")
    db.commit()

    h = login(client, u.email)
    r = client.post(f"/api/tournaments/{t.slug}/register", headers=h, json={})
    assert r.status_code == 201
    assert r.json()["status"] == "waitlist"
    reg_id = r.json()["id"]

    admin_h = login(client, owner.email)

    # Cannot approve while full
    assert (
        client.patch(
            f"/api/registrations/{reg_id}",
            headers=admin_h,
            json={"status": "approved"},
        ).status_code
        == 409
    )

    # Increase capacity
    t.max_participants = 4
    db.commit()

    # Now approval succeeds
    res = client.patch(
        f"/api/registrations/{reg_id}",
        headers=admin_h,
        json={"status": "approved"},
    )
    assert res.status_code == 200
    assert res.json()["status"] == "approved"


def test_team_registration_and_roster_overlap_check(client, db, field):
    owner, t = field(2, "league", "pubg")
    t.max_participants = 4
    t.min_team_size = 2
    t.max_team_size = 4
    db.commit()

    # Create team 1
    u1, p1 = create_player_user(db, "cap1@arena.test", "captain1")
    u2, p2 = create_player_user(db, "mem1@arena.test", "member1")
    team1 = Team(name="Squad Alpha", captain_id=p1.id)
    db.add(team1)
    db.flush()
    db.add_all([
        TeamMember(team_id=team1.id, player_id=p1.id, substitute=False),
        TeamMember(team_id=team1.id, player_id=p2.id, substitute=False),
    ])
    db.commit()

    # Create team 2 sharing member1 (overlap)
    u3, p3 = create_player_user(db, "cap2@arena.test", "captain2")
    team2 = Team(name="Squad Beta", captain_id=p3.id)
    db.add(team2)
    db.flush()
    db.add_all([
        TeamMember(team_id=team2.id, player_id=p3.id, substitute=False),
        TeamMember(team_id=team2.id, player_id=p2.id, substitute=False),
    ])
    db.commit()

    # Register team 1
    h1 = login(client, u1.email)
    r1 = client.post(f"/api/tournaments/{t.slug}/register", headers=h1, json={"team_id": team1.id})
    assert r1.status_code == 201

    # Register team 2
    h3 = login(client, u3.email)
    r2 = client.post(f"/api/tournaments/{t.slug}/register", headers=h3, json={"team_id": team2.id})
    assert r2.status_code == 201

    admin_h = login(client, owner.email)

    # Approve team 1
    a1 = client.patch(f"/api/registrations/{r1.json()['id']}", headers=admin_h, json={"status": "approved"})
    assert a1.status_code == 200

    # Approving team 2 must fail because member1 is already admitted with team 1
    a2 = client.patch(f"/api/registrations/{r2.json()['id']}", headers=admin_h, json={"status": "approved"})
    assert a2.status_code == 409


def test_cannot_approve_after_scheduling(client, db, field):
    owner, t = field(2, "single_elimination", "efootball")
    t.max_participants = 8
    db.commit()

    u, p = create_player_user(db, "late_user@arena.test", "lateplayer")
    db.commit()

    h = login(client, u.email)
    r = client.post(f"/api/tournaments/{t.slug}/register", headers=h, json={})
    reg_id = r.json()["id"]

    # Generate schedule
    generate_schedule(db, t, Schedule())
    db.commit()

    admin_h = login(client, owner.email)
    # Approving after scheduling must be locked
    res = client.patch(
        f"/api/registrations/{reg_id}",
        headers=admin_h,
        json={"status": "approved"},
    )
    assert res.status_code == 409


def test_registration_deadline_enforced(client, db, field):
    owner, t = field(2, "single_elimination", "efootball")
    t.registration_end = now() - timedelta(minutes=1)
    db.commit()

    u, p = create_player_user(db, "expired_reg@arena.test", "expiredplayer")
    db.commit()

    h = login(client, u.email)
    r = client.post(f"/api/tournaments/{t.slug}/register", headers=h, json={})
    assert r.status_code == 409
    assert "closed" in r.json()["detail"].lower()
