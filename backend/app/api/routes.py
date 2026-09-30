import hashlib
import hmac
import json
import re
import secrets
import time
from urllib.parse import parse_qsl
from datetime import timedelta
from fastapi import APIRouter, Depends, HTTPException, Request, Response, Query
from sqlalchemy import select, func, or_, delete
from app.db.session import get_db
from app.core.config import settings
from app.core.security import (
    current_user,
    staff,
    passwords,
    issue_tokens,
    authorize,
    same_origin,
)
from app.models.entities import *
from app.schemas.contracts import *
from app.services.competition import *
from app.repositories.views import *

router = APIRouter(prefix="/api")


def get_tournament(db, slug):
    t = db.scalar(select(Tournament).where(Tournament.slug == slug))
    if not t:
        raise HTTPException(404, "Tournament not found")
    return t


def get_record(db, model, key):
    value = db.get(model, key)
    if not value:
        raise HTTPException(404, "Record not found")
    return value


@router.post("/auth/signup", status_code=201)
def signup(data: Signup, response: Response, db=Depends(get_db)):
    require(
        not db.scalar(select(User.id).where(User.email == data.email)),
        "Email is already registered",
    )
    require(
        not db.scalar(
            select(Player.id).where(
                func.lower(Player.nickname) == data.nickname.lower()
            )
        ),
        "Nickname is already taken",
    )
    u = User(email=data.email, password_hash=passwords.hash(data.password))
    db.add(u)
    db.flush()
    db.add(Player(user_id=u.id, nickname=data.nickname, full_name=data.full_name))
    db.flush()
    return issue_tokens(db, u, response)


@router.post("/auth/login")
def login(data: Login, response: Response, db=Depends(get_db)):
    u = db.scalar(select(User).where(User.email == data.email))
    if not u or not passwords.verify(data.password, u.password_hash):
        raise HTTPException(401, "Incorrect email or password")
    return issue_tokens(db, u, response)


@router.post("/auth/refresh")
def refresh(request: Request, response: Response, db=Depends(get_db)):
    same_origin(request)
    value = request.cookies.get("arena_refresh", "")
    token = db.scalar(
        select(RefreshToken)
        .where(RefreshToken.digest == hashlib.sha256(value.encode()).hexdigest())
        .with_for_update()
    )
    if not token or token.revoked or token.expires_at <= now():
        raise HTTPException(401, "Session expired")
    token.revoked = True
    return issue_tokens(db, db.get(User, token.user_id), response)


@router.post("/auth/logout", status_code=204)
def logout(request: Request, response: Response, db=Depends(get_db)):
    same_origin(request)
    token = db.scalar(
        select(RefreshToken).where(
            RefreshToken.digest
            == hashlib.sha256(
                request.cookies.get("arena_refresh", "").encode()
            ).hexdigest()
        )
    )
    if token:
        token.revoked = True
        db.commit()
    response.delete_cookie("arena_refresh", path="/api/auth")


@router.get("/auth/me")
def me(user=Depends(current_user)):
    return dict(
        id=user.id,
        email=user.email,
        role=user.role,
        nickname=user.player.nickname if user.player else "Organizer",
        telegram_id=user.telegram_id,
        telegram_username=user.telegram_username,
    )


@router.post("/auth/telegram")
async def telegram_auth(request: Request, response: Response, db=Depends(get_db)):
    require(bool(settings().telegram_bot_token), "Telegram is not configured", 503)
    body = await request.json()
    require(
        isinstance(body, dict) and isinstance(body.get("init_data"), str),
        "Telegram Mini App init_data is required",
        422,
    )
    values = dict(parse_qsl(body["init_data"], keep_blank_values=True))
    provided = values.pop("hash", "")
    check = "\n".join(f"{k}={v}" for k, v in sorted(values.items()))
    secret = hmac.new(
        b"WebAppData", settings().telegram_bot_token.encode(), hashlib.sha256
    ).digest()
    require(
        hmac.compare_digest(
            hmac.new(secret, check.encode(), hashlib.sha256).hexdigest(), provided
        ),
        "Invalid Telegram signature",
        401,
    )
    try:
        require(
            abs(time.time() - int(values["auth_date"])) < 300,
            "Telegram login expired",
            401,
        )
        tg = json.loads(values["user"])
        tid = str(int(tg["id"]))
    except (KeyError, ValueError, TypeError):
        raise HTTPException(422, "Invalid Telegram identity")
    u = db.scalar(select(User).where(User.telegram_id == tid))
    # Link only with an authenticated access token; never trust form-supplied IDs.
    if request.headers.get("authorization"):
        existing = current_user(request, db)
        require(not u or u.id == existing.id, "Telegram account is already linked")
        u = existing
    if not u:
        u = User(
            email=f"tg-{tid}@telegram.arena.invalid",
            password_hash=passwords.hash(secrets.token_urlsafe(48)),
        )
        db.add(u)
        db.flush()
        db.add(
            Player(
                user_id=u.id,
                nickname=f"player_{tid}",
                full_name=tg.get("first_name", "Player")[:120],
            )
        )
    u.telegram_id = tid
    u.telegram_username = tg.get("username")
    db.flush()
    return issue_tokens(db, u, response)


@router.get("/stats")
def stats(db=Depends(get_db)):
    return dict(
        tournaments=db.scalar(
            select(func.count())
            .select_from(Tournament)
            .where(Tournament.status != "finished")
        ),
        players=db.scalar(select(func.count()).select_from(Player)),
        matches=db.scalar(
            select(func.count())
            .select_from(Match)
            .where(Match.status.in_(["completed", "walkover"]))
        ),
        champions=db.scalar(
            select(func.count())
            .select_from(Tournament)
            .where(Tournament.status == "finished")
        ),
    )


@router.get("/tournaments")
def tournaments(
    q: str = "",
    game: str = "",
    status: str = "",
    page: int = Query(1, ge=1),
    page_size: int = Query(12, ge=1, le=100),
    db=Depends(get_db),
):
    query = select(Tournament)
    if q:
        query = query.where(Tournament.name.ilike(f"%{q[:120]}%"))
    if game:
        query = query.where(Tournament.game == game)
    if status:
        query = query.where(Tournament.status == status)
    total = db.scalar(select(func.count()).select_from(query.subquery()))
    return dict(
        items=[
            tournament_view(db, t)
            for t in db.scalars(
                query.order_by(Tournament.created_at.desc())
                .offset((page - 1) * page_size)
                .limit(page_size)
            )
        ],
        total=total,
        page=page,
    )


@router.post("/tournaments", status_code=201)
def create_tournament(data: TournamentCreate, user=Depends(staff), db=Depends(get_db)):
    require(
        user.role in {"SUPER_ADMIN", "ADMIN", "TOURNAMENT_MANAGER"},
        "Tournament creation requires organizer access",
        403,
    )
    slug = re.sub(r"[^a-z0-9]+", "-", data.name.lower()).strip("-") or "tournament"
    if db.scalar(select(Tournament.id).where(Tournament.slug == slug)):
        slug += f"-{secrets.token_hex(3)}"
    t = Tournament(**data.model_dump(exclude={"rules"}), slug=slug, owner_id=user.id)
    db.add(t)
    db.flush()
    db.add(TournamentRule(tournament_id=t.id, text=data.rules))
    audit(db, user, "create", "tournament", t.id)
    db.commit()
    db.refresh(t)
    return tournament_view(db, t)


@router.get("/tournaments/{slug}")
def tournament_detail(slug: str, db=Depends(get_db)):
    t = get_tournament(db, slug)
    return {
        **tournament_view(db, t),
        "participant_list": [participant_view(p) for p in t.participants],
        "match_list": [
            match_view(db, m)
            for m in db.scalars(
                select(Match)
                .where(Match.tournament_id == t.id)
                .order_by(Match.scheduled_at, Match.id)
            )
        ],
        "groups": [
            dict(id=g.id, name=g.name, standings=standings(db, t.id, g.id))
            for g in db.scalars(select(Group).where(Group.tournament_id == t.id))
        ],
        "leaderboard": standings(db, t.id),
        "announcements": [
            dict(id=a.id, title=a.title, body=a.body)
            for a in db.scalars(
                select(Announcement)
                .where(Announcement.tournament_id == t.id)
                .order_by(Announcement.created_at.desc())
            )
        ],
    }


@router.post("/tournaments/{slug}/register", status_code=201)
def register(slug: str, data: Register, user=Depends(current_user), db=Depends(get_db)):
    t = get_tournament(db, slug)
    require(
        t.status == "registration"
        and t.registration_start <= now() <= t.registration_end,
        "Registration is closed",
    )
    require(
        not db.scalar(
            select(Registration.id).where(
                Registration.tournament_id == t.id, Registration.user_id == user.id
            )
        ),
        "You have already registered",
    )
    require(bool(user.player), "Complete your player profile first", 422)
    require(
        bool(user.player.game_ids.get(t.game)),
        "Add your game ID to your profile first",
        422,
    )
    if t.mode == "team":
        team = get_record(db, Team, data.team_id)
        require(
            team.captain_id == user.player.id, "Only the team captain can register", 403
        )
        require(
            t.min_team_size <= len(team.members) <= t.max_team_size,
            "Your team does not meet roster size requirements",
            422,
        )
        require(
            not db.scalar(
                select(Registration.id).where(
                    Registration.tournament_id == t.id, Registration.team_id == team.id
                )
            ),
            "This team has already registered",
        )
    else:
        require(data.team_id is None, "This is a solo tournament", 422)
    reg = Registration(
        tournament_id=t.id,
        user_id=user.id,
        team_id=data.team_id,
        status="waitlist" if len(t.participants) >= t.max_participants else "pending",
    )
    db.add(reg)
    db.commit()
    return dict(id=reg.id, status=reg.status)


@router.get("/registrations")
def registrations(user=Depends(current_user), db=Depends(get_db)):
    query = select(Registration).order_by(Registration.created_at.desc())
    if user.role == "PLAYER":
        query = query.where(Registration.user_id == user.id)
    elif user.role not in {"SUPER_ADMIN", "ADMIN"}:
        query = query.join(Tournament).where(Tournament.owner_id == user.id)
    return [
        dict(
            id=r.id,
            tournament_id=r.tournament_id,
            tournament=r.tournament.name,
            game=r.tournament.game,
            name=r.team.name if r.team else (r.user.player.nickname if r.user.player else "Participant"),
            status=r.status,
            created_at=iso(r.created_at),
            user_id=r.user_id,
            nickname=r.user.player.nickname if r.user.player else None,
            full_name=r.user.player.full_name if r.user.player else None,
            region=r.user.player.region if r.user.player else None,
            avatar=r.user.player.avatar if r.user.player else None,
            phone=r.user.player.phone if r.user.player else None,
            game_id=r.user.player.game_ids.get(r.tournament.game) if r.user.player else None,
            telegram_username=r.user.telegram_username,
            team_id=r.team_id,
            team=dict(
                id=r.team.id,
                name=r.team.name,
                logo=r.team.logo,
                captain=db.get(Player, r.team.captain_id).nickname if r.team.captain_id else "",
                members=[
                    dict(id=m.player_id, name=m.player.nickname, substitute=m.substitute)
                    for m in r.team.members
                ],
            ) if r.team else None,
        )
        for r in db.scalars(query)
    ]


@router.patch("/registrations/{registration_id}")
def review_registration(
    registration_id: int,
    data: ReviewRegistration,
    user=Depends(staff),
    db=Depends(get_db),
):
    r = db.scalar(
        select(Registration).where(Registration.id == registration_id).with_for_update()
    )
    require(r is not None, "Registration not found", 404)
    authorize(db, user, r.tournament)
    approve_registration(db, r, data.status)
    audit(
        db, user, "review_registration", "registration", r.id, {"status": data.status}
    )
    db.commit()
    return dict(status=r.status)


@router.post("/tournaments/{slug}/schedule", status_code=201)
def schedule(slug: str, data: Schedule, user=Depends(staff), db=Depends(get_db)):
    t = get_tournament(db, slug)
    db.scalar(select(Tournament).where(Tournament.id == t.id).with_for_update())
    authorize(db, user, t)
    generate_schedule(db, t, data)
    audit(db, user, "generate_schedule", "tournament", t.id, data.model_dump())
    db.commit()
    return tournament_detail(slug, db)


@router.get("/matches")
def matches(
    status: str = "",
    mine: bool = False,
    user_id: int | None = None,
    page: int = Query(1, ge=1),
    page_size: int = Query(30, ge=1, le=100),
    db=Depends(get_db),
):
    query = select(Match)
    if status:
        query = query.where(Match.status == status)
    # Public match browsing only; private identity filters use /users/me/matches.
    return [
        match_view(db, m)
        for m in db.scalars(
            query.order_by(Match.scheduled_at)
            .offset((page - 1) * page_size)
            .limit(page_size)
        )
    ]


@router.post("/matches", status_code=201)
def create_match(data: MatchCreate, user=Depends(staff), db=Depends(get_db)):
    t = get_record(db, Tournament, data.tournament_id)
    authorize(db, user, t)
    require(t.status != "finished", "This tournament is finished")
    require(
        t.format in {"league", "round_robin", "groups_playoffs"},
        "Use the bracket generator for knockout tournaments",
    )
    if t.game == "efootball":
        ids = {p.id for p in t.participants}
        require(
            data.home_id in ids
            and data.away_id in ids
            and data.home_id != data.away_id,
            "Select two different approved participants",
            422,
        )
        if data.group_id:
            group = get_record(db, Group, data.group_id)
            require(
                group.tournament_id == t.id, "Group belongs to another tournament", 422
            )
            members = {m.participant_id for m in group.members}
            require(
                data.home_id in members and data.away_id in members,
                "Both players must belong to the selected group",
                422,
            )
        require(
            t.format != "groups_playoffs" or data.group_id is not None,
            "Select a group for a group-stage match",
            422,
        )
        require(
            not db.scalar(select(Bracket.id).where(Bracket.tournament_id == t.id)),
            "Group stage is locked after playoffs are generated",
        )
    else:
        require(
            data.home_id is None and data.away_id is None and data.group_id is None,
            "PUBG lobbies include the entire field",
            422,
        )
    m = Match(
        **data.model_dump(),
        stage="battle_royale"
        if t.game == "pubg"
        else "group"
        if data.group_id
        else "league",
    )
    db.add(m)
    db.flush()
    audit(db, user, "create_match", "match", m.id)
    db.commit()
    return match_view(db, m)


@router.get("/users/me/matches")
def my_matches(user=Depends(current_user), db=Depends(get_db)):
    ids = [
        p.id
        for p in db.scalars(select(Participant))
        if user.id in participant_users(db, p.id)
    ]
    tids = list(
        db.scalars(select(Participant.tournament_id).where(Participant.id.in_(ids)))
    )
    return [
        match_view(db, m)
        for m in db.scalars(
            select(Match)
            .where(
                or_(
                    Match.home_id.in_(ids),
                    Match.away_id.in_(ids),
                    (Match.stage == "battle_royale") & Match.tournament_id.in_(tids),
                )
            )
            .order_by(Match.scheduled_at)
        )
    ]


@router.patch("/matches/{match_id}")
def update_match(
    match_id: int, data: MatchUpdate, user=Depends(staff), db=Depends(get_db)
):
    m = db.scalar(select(Match).where(Match.id == match_id).with_for_update())
    require(m is not None, "Match not found", 404)
    authorize(db, user, m.tournament, referee=True)
    require(m.status not in {"completed", "walkover"}, "Settled matches are immutable")
    if data.status == "walkover":
        require(
            m.tournament.game == "efootball"
            and data.winner_id is not None
            and data.winner_id in {m.home_id, m.away_id},
            "Choose an assigned opponent as the winner",
            422,
        )
        m.winner_id = data.winner_id
        m.home_score, m.away_score = (3, 0) if data.winner_id == m.home_id else (0, 3)
        advance(db, m)
    if data.status == "live":
        require(
            m.tournament.game == "pubg" or (m.home_id and m.away_id),
            "Both opponents must be assigned",
        )
        m.tournament.status = "live"
    m.status = data.status
    if data.scheduled_at:
        m.scheduled_at = (
            data.scheduled_at.replace(tzinfo=None)
            if not data.scheduled_at.tzinfo
            else data.scheduled_at.astimezone(timezone.utc).replace(tzinfo=None)
        )
    rebuild_standings(db, m.tournament_id)
    audit(db, user, "update_match", "match", m.id, {"status": m.status})
    db.commit()
    return match_view(db, m)


@router.post("/matches/{match_id}/results", status_code=201)
def submit_result(
    match_id: int, data: ResultSubmit, user=Depends(current_user), db=Depends(get_db)
):
    m = db.scalar(select(Match).where(Match.id == match_id).with_for_update())
    require(m is not None, "Match not found", 404)
    require(
        m.tournament.game == "efootball", "Use PUBG scoring for this tournament", 422
    )
    require(
        m.status in {"scheduled", "live"}, "This match is already settled or cancelled"
    )
    require(m.home_id and m.away_id, "Both opponents must be assigned")
    if user.role == "PLAYER":
        require(
            user.id
            in participant_users(db, m.home_id) + participant_users(db, m.away_id),
            "Only opponents may submit a result",
            403,
        )
        require(
            not db.scalar(
                select(MatchResult.id).where(
                    MatchResult.match_id == m.id,
                    MatchResult.state.in_(["pending", "disputed"]),
                )
            ),
            "A result is already awaiting resolution",
        )
    else:
        authorize(db, user, m.tournament, referee=True)
    winner(
        data.home_score,
        data.away_score,
        data.home_penalties,
        data.away_penalties,
        m.stage not in {"group", "league"},
    )
    r = MatchResult(match_id=m.id, submitted_by=user.id, **data.model_dump())
    db.add(r)
    db.flush()
    if user.role != "PLAYER":
        for previous in db.scalars(
            select(MatchResult).where(
                MatchResult.match_id == m.id,
                MatchResult.id != r.id,
                MatchResult.state.in_(["pending", "disputed"]),
            )
        ):
            previous.state = "superseded"
        confirm_result(db, m, r, user)
    audit(db, user, "submit_result", "match", m.id, data.model_dump())
    db.commit()
    return dict(id=r.id, state=r.state)


@router.patch("/results/{result_id}")
def decide_result(
    result_id: int, data: ResultDecision, user=Depends(current_user), db=Depends(get_db)
):
    r = get_record(db, MatchResult, result_id)
    m = db.scalar(select(Match).where(Match.id == r.match_id).with_for_update())
    require(r.state in {"pending", "disputed"}, "Result already resolved")
    if user.role == "PLAYER":
        submitter_home = r.submitted_by in participant_users(db, m.home_id)
        opponent_ids = participant_users(db, m.away_id if submitter_home else m.home_id)
        require(
            user.id in opponent_ids,
            "Only the opposing side can confirm or dispute",
            403,
        )
        require(r.state == "pending", "A referee must resolve disputed results")
    else:
        authorize(db, user, m.tournament, referee=True)
    if data.state == "confirmed":
        confirm_result(db, m, r, user)
    else:
        r.state = "disputed"
        audit(db, user, "dispute_result", "match", m.id, {"result_id": r.id})
    db.commit()
    return dict(state=r.state)


@router.put("/matches/{match_id}/pubg")
def submit_pubg(
    match_id: int, data: PubgSubmit, user=Depends(staff), db=Depends(get_db)
):
    m = db.scalar(select(Match).where(Match.id == match_id).with_for_update())
    require(m is not None, "Match not found", 404)
    authorize(db, user, m.tournament, referee=True)
    require(m.tournament.game == "pubg", "This match does not use PUBG scoring", 422)
    require(
        m.status not in {"completed", "cancelled"},
        "This match is already settled or cancelled",
    )
    ids = {p.id for p in m.tournament.participants}
    require(
        len(data.results) == len(ids)
        and {r.participant_id for r in data.results} == ids,
        "Enter a result for every registered team exactly once",
        422,
    )
    require(
        {r.placement for r in data.results} == set(range(1, len(ids) + 1)),
        "Placements must be unique and cover the full field",
        422,
    )
    for row in data.results:
        pp, kp, total = pubg_points(
            row.placement,
            row.kills,
            m.tournament.rules.placement_points,
            m.tournament.rules.kill_points,
        )
        db.add(
            PubgMatchResult(
                match_id=m.id,
                **row.model_dump(),
                placement_points=pp,
                kill_points=kp,
                total=total,
            )
        )
    m.status = "completed"
    rebuild_standings(db, m.tournament_id)
    finish_league(db, m.tournament)
    audit(db, user, "pubg_result", "match", m.id, data.model_dump())
    db.commit()
    return match_view(db, m)


@router.put("/tournaments/{slug}/scoring")
def scoring(slug: str, data: Scoring, user=Depends(staff), db=Depends(get_db)):
    t = get_tournament(db, slug)
    authorize(db, user, t)
    require(t.game == "pubg", "Only PUBG supports placement scoring", 422)
    require(
        not db.scalar(
            select(Match.id).where(
                Match.tournament_id == t.id, Match.status.in_(["live", "completed"])
            )
        ),
        "Scoring rules lock when competition begins",
    )
    t.rules.placement_points, t.rules.kill_points = (
        data.placement_points,
        data.kill_points,
    )
    audit(db, user, "update_scoring", "tournament", t.id, data.model_dump())
    db.commit()
    return dict(ok=True)


@router.get("/groups/{slug}")
def groups(slug: str, db=Depends(get_db)):
    return tournament_detail(slug, db)["groups"]


@router.get("/brackets/{slug}")
def bracket(slug: str, db=Depends(get_db)):
    return [
        m for m in tournament_detail(slug, db)["match_list"] if m["bracket_round_id"]
    ]


@router.get("/leaderboard")
def leaderboard(slug: str = "", db=Depends(get_db)):
    if slug:
        return standings(db, get_tournament(db, slug).id)
    rows = [player_view(db, p) for p in db.scalars(select(Player))]
    return sorted(rows, key=lambda r: (-r["points"], -r["win_rate"], r["nickname"]))


@router.get("/players")
def players(q: str = "", page: int = Query(1, ge=1), db=Depends(get_db)):
    return [
        player_view(db, p)
        for p in db.scalars(
            select(Player)
            .where(Player.nickname.ilike(f"%{q[:80]}%"))
            .offset((page - 1) * 24)
            .limit(24)
        )
    ]


@router.get("/players/{username}")
def player(username: str, db=Depends(get_db)):
    p = db.scalar(select(Player).where(func.lower(Player.nickname) == username.lower()))
    require(p is not None, "Player not found", 404)
    return player_view(db, p)


@router.put("/users/me/profile")
def update_profile(data: ProfileUpdate, user=Depends(current_user), db=Depends(get_db)):
    for key, value in data.model_dump().items():
        setattr(user.player, key, value)
    db.commit()
    return player_view(db, user.player)


def team_view(db, t):
    pids = list(db.scalars(select(Participant.id).where(Participant.team_id == t.id)))
    ms = list(
        db.scalars(
            select(Match).where(
                or_(Match.home_id.in_(pids), Match.away_id.in_(pids)),
                Match.status.in_(["completed", "walkover"]),
            )
        )
    )
    pubg = list(
        db.scalars(
            select(PubgMatchResult).where(PubgMatchResult.participant_id.in_(pids))
        )
    )
    wins = sum(m.winner_id in pids for m in ms) + sum(r.placement == 1 for r in pubg)
    count = len(ms) + len(pubg)
    return dict(
        id=t.id,
        name=t.name,
        logo=t.logo,
        captain_id=t.captain_id,
        captain=db.get(Player, t.captain_id).nickname,
        members=[
            dict(id=m.player_id, name=m.player.nickname, substitute=m.substitute)
            for m in t.members
        ],
        matches=count,
        wins=wins,
        losses=count - wins,
        win_rate=round(100 * wins / count) if count else 0,
        titles=sum(
            m.winner_id in pids
            and not m.next_match_id
            and m.stage in {"playoff", "grand_final", "reset_final"}
            for m in ms
        ),
        recent_matches=[match_view(db, m) for m in ms[-6:]],
    )


@router.get("/teams")
def teams(db=Depends(get_db)):
    return [team_view(db, t) for t in db.scalars(select(Team))]


@router.get("/teams/{team_id}")
def team(team_id: int, db=Depends(get_db)):
    return team_view(db, get_record(db, Team, team_id))


@router.post("/teams", status_code=201)
def create_team(data: TeamCreate, user=Depends(current_user), db=Depends(get_db)):
    require(
        not db.scalar(select(Team.id).where(Team.name == data.name)),
        "Team name already exists",
    )
    ids = list(dict.fromkeys([user.player.id, *data.player_ids, *data.substitute_ids]))
    require(len(ids) <= 12, "Teams are limited to 12 members", 422)
    for pid in ids:
        get_record(db, Player, pid)
    t = Team(name=data.name, logo=data.logo, captain_id=user.player.id)
    db.add(t)
    db.flush()
    for pid in ids:
        db.add(
            TeamMember(
                team_id=t.id,
                player_id=pid,
                substitute=pid in data.substitute_ids and pid != user.player.id,
            )
        )
    db.commit()
    return team_view(db, t)


@router.get("/notifications")
def notifications(user=Depends(current_user), db=Depends(get_db)):
    return [
        dict(
            id=n.id,
            title=n.title,
            body=n.body,
            read=n.read,
            created_at=iso(n.created_at),
        )
        for n in db.scalars(
            select(Notification)
            .where(Notification.user_id == user.id)
            .order_by(Notification.created_at.desc())
            .limit(100)
        )
    ]


@router.patch("/notifications/{notification_id}")
def read_notification(
    notification_id: int, user=Depends(current_user), db=Depends(get_db)
):
    n = get_record(db, Notification, notification_id)
    require(n.user_id == user.id, "This notification belongs to another account", 403)
    n.read = True
    db.commit()
    return dict(ok=True)


@router.post("/announcements", status_code=201)
def announce(data: AnnouncementCreate, user=Depends(staff), db=Depends(get_db)):
    t = get_record(db, Tournament, data.tournament_id)
    authorize(db, user, t)
    a = Announcement(author_id=user.id, **data.model_dump())
    db.add(a)
    for uid in {u for p in t.participants for u in participant_users(db, p.id)}:
        notify(db, uid, data.title, data.body)
    audit(db, user, "announcement", "tournament", t.id, data.model_dump())
    db.commit()
    return dict(id=a.id)


@router.get("/admin")
def admin(user=Depends(staff), db=Depends(get_db)):
    ts = list(db.scalars(select(Tournament)))
    if user.role not in {"SUPER_ADMIN", "ADMIN"}:
        ts = [
            t
            for t in ts
            if t.owner_id == user.id
            or db.scalar(
                select(AdminUser.id).where(
                    AdminUser.user_id == user.id, AdminUser.tournament_id == t.id
                )
            )
        ]
    ids = [t.id for t in ts]
    ms = list(db.scalars(select(Match).where(Match.tournament_id.in_(ids))))
    return dict(
        tournaments=[tournament_view(db, t) for t in ts],
        registrations=registrations(user, db),
        matches=[match_view(db, m) for m in ms],
        players=db.scalar(select(func.count()).select_from(Player)),
        activity=[
            dict(
                id=a.id,
                action=a.action,
                entity=a.entity,
                entity_id=a.entity_id,
                created_at=iso(a.created_at),
            )
            for a in db.scalars(
                select(AuditLog)
                .where(AuditLog.actor_id == user.id)
                .order_by(AuditLog.created_at.desc())
                .limit(10)
            )
        ],
        telegram_configured=bool(settings().telegram_bot_token),
        telegram_linked=bool(user.telegram_id),
    )


@router.get("/admin/users")
def admin_users(user=Depends(staff), db=Depends(get_db)):
    require(user.role in {"ADMIN", "SUPER_ADMIN"}, "Administrator access required", 403)
    return [
        dict(
            id=u.id,
            email=u.email,
            role=u.role,
            nickname=u.player.nickname if u.player else "Organizer",
        )
        for u in db.scalars(select(User))
    ]


@router.patch("/admin/users/{user_id}")
def change_role(
    user_id: int, data: RoleUpdate, user=Depends(staff), db=Depends(get_db)
):
    require(
        user.role == "SUPER_ADMIN", "Only super administrators can assign roles", 403
    )
    require(user.id != user_id, "You cannot change your own role")
    u = get_record(db, User, user_id)
    if data.tournament_id:
        get_record(db, Tournament, data.tournament_id)
    u.role = data.role
    db.execute(delete(AdminUser).where(AdminUser.user_id == u.id))
    if data.role != "PLAYER":
        db.add(AdminUser(user_id=u.id, tournament_id=data.tournament_id))
    audit(db, user, "change_role", "user", u.id, data.model_dump())
    db.commit()
    return dict(ok=True)


@router.post("/bot/session")
async def bot_session(request: Request, response: Response, db=Depends(get_db)):
    secret = request.headers.get("X-Bot-Secret", "")
    require(
        bool(settings().bot_api_secret)
        and hmac.compare_digest(secret, settings().bot_api_secret),
        "Invalid bot credential",
        401,
    )
    body = await request.json()
    try:
        tid = str(int(body["telegram_id"]))
    except (KeyError, ValueError, TypeError):
        raise HTTPException(422, "Invalid Telegram ID")
    u = db.scalar(select(User).where(User.telegram_id == tid))
    if not u:
        u = User(
            email=f"tg-{tid}@telegram.arena.invalid",
            password_hash=passwords.hash(secrets.token_urlsafe(48)),
            telegram_id=tid,
            telegram_username=body.get("username"),
        )
        db.add(u)
        db.flush()
        db.add(
            Player(
                user_id=u.id,
                nickname=f"player_{tid}",
                full_name=str(body.get("name", "Player"))[:120],
            )
        )
        db.flush()
    return issue_tokens(db, u, response)
