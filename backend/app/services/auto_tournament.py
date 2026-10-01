import logging
from sqlalchemy import select
from app.db.session import SessionLocal
from app.models.entities import Tournament, Match, Participant, Announcement, now
from app.schemas.contracts import Schedule
from app.services.competition import generate_schedule

log = logging.getLogger("arena.auto_tournament")


def announce(db, tournament, title, body):
    exists = db.scalar(
        select(Announcement.id).where(
            Announcement.tournament_id == tournament.id,
            Announcement.title == title,
        ).limit(1)
    )
    if not exists:
        db.add(
            Announcement(
                tournament_id=tournament.id,
                author_id=tournament.owner_id,
                title=title,
                body=body,
            )
        )


def auto_create_initial_schedule(db, tournament):
    existing = db.scalar(
        select(Match.id).where(Match.tournament_id == tournament.id).limit(1)
    )
    if existing:
        return False

    participants = list(
        db.scalars(
            select(Participant).where(Participant.tournament_id == tournament.id)
        )
    )
    if len(participants) < 2:
        return False

    data = Schedule(
        randomize=True,
        interval_minutes=30,
        group_count=2,
        pubg_rounds=4,
        qualify_per_group=2,
    )
    generate_schedule(db, tournament, data)
    announce(
        db,
        tournament,
        "Turnir jadvali tayyor",
        f"{tournament.name} uchun o'yinlar jadvali avtomatik yaratildi. "
        "Keyingi o'yinlarni turnir sahifasida ko'rishingiz mumkin.",
    )
    return True


def auto_create_playoffs(db, tournament):
    if tournament.format != "groups_playoffs":
        return False

    matches = list(
        db.scalars(
            select(Match)
            .where(Match.tournament_id == tournament.id)
            .order_by(Match.id)
        )
    )
    group_matches = [m for m in matches if m.stage == "group"]
    playoff_matches = [m for m in matches if m.stage != "group"]

    if not group_matches or playoff_matches:
        return False

    if not all(m.status in {"completed", "walkover"} for m in group_matches):
        return False

    data = Schedule(
        playoffs=True,
        randomize=False,
        interval_minutes=30,
        qualify_per_group=2,
    )
    generate_schedule(db, tournament, data)
    announce(
        db,
        tournament,
        "Playoff bosqichi tayyor",
        f"{tournament.name} guruh bosqichi yakunlandi. "
        "Playoff juftliklari avtomatik yaratildi va turnir sahifasida e'lon qilindi.",
    )
    return True


def run_auto_tournaments():
    with SessionLocal() as db:
        try:
            registration_tournaments = list(
                db.scalars(
                    select(Tournament)
                    .where(
                        Tournament.status == "registration",
                        Tournament.registration_end <= now(),
                    )
                    .with_for_update(skip_locked=True)
                )
            )

            for tournament in registration_tournaments:
                try:
                    if auto_create_initial_schedule(db, tournament):
                        db.commit()
                        log.info(
                            "Auto schedule created for tournament %s",
                            tournament.id,
                        )
                    else:
                        db.rollback()
                except Exception:
                    db.rollback()
                    log.exception(
                        "Auto schedule failed for tournament %s",
                        tournament.id,
                    )

            playoff_tournaments = list(
                db.scalars(
                    select(Tournament)
                    .where(
                        Tournament.format == "groups_playoffs",
                        Tournament.status.in_(["upcoming", "live"]),
                    )
                    .with_for_update(skip_locked=True)
                )
            )

            for tournament in playoff_tournaments:
                try:
                    if auto_create_playoffs(db, tournament):
                        db.commit()
                        log.info(
                            "Auto playoffs created for tournament %s",
                            tournament.id,
                        )
                    else:
                        db.rollback()
                except Exception:
                    db.rollback()
                    log.exception(
                        "Auto playoffs failed for tournament %s",
                        tournament.id,
                    )
        except Exception:
            db.rollback()
            log.exception("Auto tournament scan failed")

