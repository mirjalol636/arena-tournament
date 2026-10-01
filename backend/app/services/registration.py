from fastapi import HTTPException
from sqlalchemy import func, select

from app.models.entities import Participant, Registration, TeamMember, Tournament, now


def locked_tournament(db, tournament_id):
    # Bitta lock tartibi: tournament -> registration -> team.
    # PostgreSQL bir vaqtdagi registration/approval amallarini xavfsiz ketma-ketlashtiradi.
    return db.scalar(
        select(Tournament)
        .where(Tournament.id == tournament_id)
        .with_for_update()
        .execution_options(populate_existing=True)
    )


def registration_window(t, at=None):
    at = at or now()

    if t.status == "finished":
        return "finished"

    if t.status != "registration":
        return "closed"

    if at < t.registration_start:
        return "not_started"

    if at > t.registration_end:
        return "ended"

    return "open"


def assert_open(t):
    state = registration_window(t)

    if state != "open":
        messages = {
            "not_started": "Ro‘yxatdan o‘tish hali boshlanmagan.",
            "ended": "Ro‘yxatdan o‘tish muddati tugagan.",
            "finished": "Turnir yakunlangan.",
            "closed": "Tashkilotchi ro‘yxatdan o‘tishni yopgan.",
        }

        raise HTTPException(
            409,
            detail={
                "code": f"registration_{state}",
                "message": messages[state],
            },
        )


def registration_state(db, t, user=None):
    total = db.scalar(
        select(func.count())
        .select_from(Participant)
        .where(Participant.tournament_id == t.id)
    )

    own = (
        db.scalar(
            select(Registration).where(
                Registration.tournament_id == t.id,
                Registration.user_id == user.id,
            )
        )
        if user
        else None
    )

    admitted = bool(
        user
        and user.player
        and db.scalar(
            select(Participant.id).where(
                Participant.tournament_id == t.id,
                (
                    (Participant.player_id == user.player.id)
                    | Participant.team_id.in_(
                        select(TeamMember.team_id).where(
                            TeamMember.player_id == user.player.id
                        )
                    )
                ),
            )
        )
    )

    state = registration_window(t)

    return {
        "window": state,
        "full": total >= t.max_participants,
        "available": max(0, t.max_participants - total),
        "registration": (
            {"id": own.id, "status": own.status}
            if own
            else None
        ),
        "already_participant": admitted,
        "server_now": now().isoformat(timespec="seconds") + "Z",
    }
