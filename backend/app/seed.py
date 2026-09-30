import os
from datetime import timedelta
from sqlalchemy import select
from app.db.session import SessionLocal
from app.models.entities import *
from app.core.security import passwords
from app.core.config import settings
from app.services.competition import (
    generate_schedule,
    confirm_result,
    rebuild_standings,
    pubg_points,
)
from app.schemas.contracts import Schedule


def seed():
    if settings().environment != "development":
        raise RuntimeError("Demo seed is restricted to development")
    password = os.environ.get("DEMO_PASSWORD")
    if not password or len(password) < 10:
        raise RuntimeError("Set DEMO_PASSWORD (at least 10 characters) before seeding")
    with SessionLocal() as db:
        if db.scalar(select(Tournament.id)):
            print("Demo data already exists; no changes made.")
            return
        db.add_all(
            [
                Game(slug="efootball", name="eFootball"),
                Game(slug="pubg", name="PUBG Mobile"),
            ]
        )
        admin = User(
            email="admin@arena.local",
            password_hash=passwords.hash(password),
            role="SUPER_ADMIN",
        )
        db.add(admin)
        db.flush()
        db.add(
            Player(user_id=admin.id, nickname="Organizer", full_name="Arena Organizer")
        )
        db.add(AdminUser(user_id=admin.id))
        names = [
            "Mirjalol",
            "Sardorbek",
            "Zafardiyor",
            "Baxtiyor",
            "Abdunasif",
            "Olmosbek",
            "Mardon",
            "Foziljon",
        ]
        players = []
        for i, name in enumerate(names):
            u = User(
                email=f"{name.lower()}@arena.local",
                password_hash=passwords.hash(password),
            )
            db.add(u)
            db.flush()
            p = Player(
                user_id=u.id,
                nickname=name,
                full_name=f"{name} Karimov",
                region="Andijan, UZ",
                game_ids={"efootball": f"UZ-{10482 + i}", "pubg": f"51{123400 + i}"},
            )
            db.add(p)
            players.append(p)
        db.flush()
        start = now() - timedelta(hours=8)
        cup = Tournament(
            name="Andijan eFootball Cup 2026",
            slug="andijan-efootball-cup-2026",
            game="efootball",
            format="groups_playoffs",
            mode="solo",
            status="live",
            description="The city's best. One stage. One champion. Andijan's premier eFootball competition brings eight contenders together for a place in the final.",
            max_participants=8,
            prize_pool=1500,
            prizes={"1": 900, "2": 450, "3": 150},
            owner_id=admin.id,
            registration_start=start - timedelta(days=14),
            registration_end=start - timedelta(days=1),
            start_date=start,
        )
        db.add(cup)
        db.flush()
        db.add(
            TournamentRule(
                tournament_id=cup.id,
                text="10-minute matches · Standard teams · No custom squads.\nGroup scoring: win 3, draw 1, loss 0. Ties: goal difference, goals scored, wins, alphabetical nickname.\nTop 2 in each group advance. Playoff draws go to extra time and penalties.\nCheck in 15 minutes early. A 10-minute no-show results in a 3–0 walkover.\nPlayers submit results; the opponent confirms. Disputes are resolved by a referee.",
            )
        )
        db.add_all(
            [
                Participant(tournament_id=cup.id, player_id=p.id, seed=i + 1)
                for i, p in enumerate(players)
            ]
        )
        db.flush()
        db.refresh(cup)
        generate_schedule(db, cup, Schedule(group_count=2, interval_minutes=35))
        group_matches = list(
            db.scalars(
                select(Match).where(Match.tournament_id == cup.id).order_by(Match.id)
            )
        )
        scores = [
            (3, 1),
            (2, 0),
            (1, 1),
            (2, 1),
            (4, 2),
            (1, 0),
            (2, 3),
            (1, 0),
            (2, 2),
            (3, 0),
            (1, 2),
            (2, 0),
        ]
        for m, (a, b) in zip(group_matches, scores):
            r = MatchResult(
                match_id=m.id, submitted_by=admin.id, home_score=a, away_score=b
            )
            db.add(r)
            db.flush()
            confirm_result(db, m, r, admin)
        generate_schedule(db, cup, Schedule(playoffs=True))
        playoffs = list(
            db.scalars(
                select(Match)
                .where(Match.tournament_id == cup.id, Match.stage == "playoff")
                .order_by(Match.id)
            )
        )
        playoffs[0].status = "live"
        playoffs[0].home_score, playoffs[0].away_score = 2, 1
        for i, m in enumerate(playoffs):
            m.scheduled_at = now() + timedelta(minutes=20 * i)
        cup.status = "live"
        open_cup = Tournament(
            name="eFootball Open Series",
            slug="efootball-open-series",
            game="efootball",
            format="single_elimination",
            mode="solo",
            status="registration",
            description="Your next chapter starts here. Open registration for the next wave of eFootball contenders.",
            max_participants=32,
            prize_pool=750,
            owner_id=admin.id,
            registration_start=now() - timedelta(days=2),
            registration_end=now() + timedelta(days=7),
            start_date=now() + timedelta(days=8),
        )
        db.add(open_cup)
        db.flush()
        db.add(
            TournamentRule(
                tournament_id=open_cup.id,
                text="Single elimination. 10-minute matches. Extra time and penalties enabled. Check in 15 minutes before your match.",
            )
        )
        for p in players[:3]:
            db.add(Registration(tournament_id=open_cup.id, user_id=p.user_id))
        pubg = Tournament(
            name="PUBG Mobile Night League",
            slug="pubg-mobile-night-league",
            game="pubg",
            format="league",
            mode="team",
            status="registration",
            description="Drop in. Gear up. Outlast them all. A four-map squad competition across Erangel and Miramar.",
            max_participants=16,
            prize_pool=2500,
            owner_id=admin.id,
            registration_start=now() - timedelta(days=3),
            registration_end=now() + timedelta(days=5),
            start_date=now() + timedelta(days=6),
        )
        db.add(pubg)
        db.flush()
        db.add(
            TournamentRule(
                tournament_id=pubg.id,
                text="Four-player squads plus up to two substitutes. Placement: 10, 6, 5, 4, 3, 2, 1, 1 points. One point per elimination. Ties break on kill points, then wins, then team name. No emulators or unauthorized software.",
            )
        )
        for i, name in enumerate(["NOVA Esports", "Andijan Wolves"]):
            t = Team(name=name, captain_id=players[i * 4].id)
            db.add(t)
            db.flush()
            for p in players[i * 4 : (i + 1) * 4]:
                db.add(TeamMember(team_id=t.id, player_id=p.id))
            db.add(Participant(tournament_id=pubg.id, team_id=t.id, seed=i + 1))
        db.flush()
        db.refresh(pubg)
        seed_pubg_results(db, pubg)
        db.add(
            Announcement(
                tournament_id=cup.id,
                author_id=admin.id,
                title="The final four are here",
                body="Group stages are complete. The semi finals are now live. Follow every result in the match center.",
            )
        )
        db.add(
            AuditLog(
                actor_id=admin.id,
                action="published_demo",
                entity="tournament",
                entity_id=cup.id,
            )
        )
        db.commit()
        print("Seeded 3 tournaments, 8 contenders, 2 squads and the playoff bracket.")


def seed_pubg_results(db, pubg):
    """A live four-map demonstration, with a separate open qualifier for team registration."""
    if db.scalar(select(Match.id).where(Match.tournament_id == pubg.id)):
        return
    pubg.start_date = now() - timedelta(hours=2)
    pubg.registration_end = pubg.start_date - timedelta(hours=1)
    generate_schedule(db, pubg, Schedule(pubg_rounds=4, interval_minutes=40))
    maps = list(
        db.scalars(
            select(Match).where(Match.tournament_id == pubg.id).order_by(Match.id)
        )
    )
    for i, m in enumerate(maps[:2]):
        for j, p in enumerate(pubg.participants):
            place = (j + i) % len(pubg.participants) + 1
            kills = 7 + i * 2 - j
            pp, kp, total = pubg_points(
                place, kills, pubg.rules.placement_points, pubg.rules.kill_points
            )
            db.add(
                PubgMatchResult(
                    match_id=m.id,
                    participant_id=p.id,
                    placement=place,
                    kills=kills,
                    placement_points=pp,
                    kill_points=kp,
                    total=total,
                )
            )
        m.status = "completed"
    maps[2].status = "live"
    pubg.status = "live"
    rebuild_standings(db, pubg.id)
    qualifier = Tournament(
        name="PUBG Mobile Open Qualifier",
        slug="pubg-mobile-open-qualifier",
        game="pubg",
        format="league",
        mode="team",
        status="registration",
        description="Bring your squad. Registration is open for the next ARENA battle royale qualifier.",
        max_participants=16,
        prize_pool=1000,
        owner_id=pubg.owner_id,
        registration_start=now() - timedelta(days=1),
        registration_end=now() + timedelta(days=5),
        start_date=now() + timedelta(days=6),
    )
    db.add(qualifier)
    db.flush()
    db.add(TournamentRule(tournament_id=qualifier.id, text=pubg.rules.text))


if __name__ == "__main__":
    seed()
