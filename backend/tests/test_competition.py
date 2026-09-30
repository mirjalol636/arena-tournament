import pytest
from fastapi import HTTPException
from sqlalchemy import select
from app.models.entities import *
from app.services.competition import *
from app.schemas.contracts import Schedule, ResultSubmit


@pytest.mark.parametrize(
    "home,away,hp,ap,expected",
    [
        (3, 2, None, None, "home"),
        (0, 1, None, None, "away"),
        (2, 2, None, None, None),
        (1, 1, 4, 5, "away"),
    ],
)
def test_winner(home, away, hp, ap, expected):
    assert winner(home, away, hp, ap) == expected


def test_knockout_draw_rejected():
    with pytest.raises(HTTPException):
        winner(1, 1, knockout=True)


def test_penalty_validation():
    with pytest.raises(ValueError):
        ResultSubmit(home_score=2, away_score=1, home_penalties=5, away_penalties=4)
    with pytest.raises(ValueError):
        ResultSubmit(home_score=1, away_score=1, home_penalties=5)


@pytest.mark.parametrize("count", [3, 4, 5, 8])
def test_round_robin_exact_pair_coverage(count):
    rounds = round_robin(list(range(count)))
    pairs = [tuple(sorted(pair)) for r in rounds for pair in r]
    assert len(pairs) == count * (count - 1) // 2
    assert len(set(pairs)) == len(pairs)
    for r in rounds:
        ids = [p for pair in r for p in pair]
        assert len(set(ids)) == len(ids)


def test_pubg_scoring():
    assert pubg_points(1, 8, {"1": 10}, 2) == (10, 16, 26)
    assert pubg_points(9, 2, {"1": 10}, 1) == (0, 2, 2)


def complete(db, m, owner, a=2, b=1):
    r = MatchResult(match_id=m.id, submitted_by=owner.id, home_score=a, away_score=b)
    db.add(r)
    db.flush()
    confirm_result(db, m, r, owner)
    db.flush()


def test_standings_and_immutable_result(db, field):
    owner, t = field(4, "league")
    generate_schedule(db, t, Schedule())
    m = db.scalar(select(Match).where(Match.tournament_id == t.id))
    complete(db, m, owner, 3, 1)
    rows = standings(db, t.id)
    assert rows[0]["points"] == 3 and rows[0]["gd"] == 2
    assert sum(r["played"] for r in rows) == 2
    assert sum(r["gf"] for r in rows) == 4
    with pytest.raises(HTTPException):
        complete(db, m, owner)


@pytest.mark.parametrize("count", [3, 5, 8, 16, 32])
def test_single_elimination_with_byes(db, field, count):
    owner, t = field(count)
    generate_schedule(db, t, Schedule())
    for _ in range(10):
        available = list(
            db.scalars(
                select(Match).where(
                    Match.tournament_id == t.id,
                    Match.status == "scheduled",
                    Match.home_id.is_not(None),
                    Match.away_id.is_not(None),
                )
            )
        )
        if not available:
            break
        for m in available:
            complete(db, m, owner)
    rows = list(db.scalars(select(Match).where(Match.tournament_id == t.id)))
    assert all(m.status in {"completed", "walkover"} for m in rows)
    assert sum(m.status == "completed" for m in rows) == count - 1
    assert t.status == "finished"


@pytest.mark.parametrize("count", [2, 4, 8, 16])
@pytest.mark.parametrize("reset", [False, True])
def test_double_elimination_and_reset(db, field, count, reset):
    owner, t = field(count, "double_elimination")
    generate_schedule(db, t, Schedule())
    for _ in range(30):
        available = list(
            db.scalars(
                select(Match).where(
                    Match.tournament_id == t.id,
                    Match.status == "scheduled",
                    Match.home_id.is_not(None),
                    Match.away_id.is_not(None),
                )
            )
        )
        if not available:
            break
        for m in available:
            complete(
                db,
                m,
                owner,
                1 if reset and m.stage == "grand_final" else 2,
                2 if reset and m.stage == "grand_final" else 1,
            )
    rows = list(db.scalars(select(Match).where(Match.tournament_id == t.id)))
    assert all(m.status == "completed" for m in rows)
    assert len(rows) == 2 * count - 2 + int(reset)
    assert t.status == "finished"
    losses = {p.id: 0 for p in t.participants}
    for m in rows:
        losses[m.away_id if m.winner_id == m.home_id else m.home_id] += 1
    assert sum(v == 2 for v in losses.values()) == count - 1


def test_schedule_cannot_be_replaced(db, field):
    owner, t = field(4)
    generate_schedule(db, t, Schedule())
    with pytest.raises(HTTPException):
        generate_schedule(db, t, Schedule())


def test_group_qualification_gate(db, field):
    owner, t = field(8, "groups_playoffs")
    generate_schedule(db, t, Schedule(group_count=2))
    with pytest.raises(HTTPException):
        generate_schedule(db, t, Schedule(playoffs=True))
    for m in list(db.scalars(select(Match).where(Match.tournament_id == t.id))):
        complete(db, m, owner)
    generate_schedule(db, t, Schedule(playoffs=True))
    assert (
        len(
            list(
                db.scalars(
                    select(Match).where(
                        Match.tournament_id == t.id, Match.stage == "playoff"
                    )
                )
            )
        )
        == 3
    )


def test_manual_seeding_rejects_duplicate(db, field):
    _, t = field(4)
    with pytest.raises(HTTPException):
        generate_schedule(
            db,
            t,
            Schedule(seeds=[p.id for p in t.participants[:3]] + [t.participants[0].id]),
        )
