import random
from datetime import timedelta
from fastapi import HTTPException
from sqlalchemy import select, delete, or_
from app.models.entities import *


def require(condition, detail, code=409):
    if not condition:
        raise HTTPException(code, detail)


def audit(db, user, action, entity, entity_id, details=None):
    db.add(
        AuditLog(
            actor_id=user.id,
            action=action,
            entity=entity,
            entity_id=entity_id,
            details=details or {},
        )
    )


def notify(db, user_id, title, body, key=None):
    if key and db.scalar(select(Notification.id).where(Notification.dedupe_key == key)):
        return
    db.add(Notification(user_id=user_id, title=title, body=body, dedupe_key=key))


def participant_users(db, participant_id):
    p = db.get(Participant, participant_id)
    if not p:
        return []
    if p.player:
        return [p.player.user_id]
    return [m.player.user_id for m in p.team.members]


def winner(home, away, hp=None, ap=None, knockout=False):
    if home > away:
        return "home"
    if away > home:
        return "away"
    if hp is not None and ap is not None and hp != ap:
        return "home" if hp > ap else "away"
    require(not knockout, "A knockout match needs a winner; enter penalty scores")
    return None


def pubg_points(placement, kills, placement_points, kill_value):
    require(placement >= 1 and kills >= 0, "Invalid PUBG result", 422)
    pp = placement_points.get(str(placement), 0)
    kp = kills * kill_value
    return pp, kp, pp + kp


def round_robin(ids):
    slots = list(ids)
    if len(slots) % 2:
        slots.append(None)
    rounds = []
    for r in range(len(slots) - 1):
        pairs = [
            (slots[i], slots[-1 - i]) if r % 2 == 0 else (slots[-1 - i], slots[i])
            for i in range(len(slots) // 2)
        ]
        rounds.append([(a, b) for a, b in pairs if a is not None and b is not None])
        slots = [slots[0], slots[-1], *slots[1:-1]]
    return rounds


def standings(db, tournament_id, group_id=None):
    participants = list(
        db.scalars(
            select(Participant).where(Participant.tournament_id == tournament_id)
        )
    )
    if group_id:
        member_ids = set(
            db.scalars(
                select(GroupMember.participant_id).where(
                    GroupMember.group_id == group_id
                )
            )
        )
        participants = [p for p in participants if p.id in member_ids]
    rows = {
        p.id: dict(
            participant_id=p.id,
            name=p.name,
            player_id=p.player_id,
            team_id=p.team_id,
            played=0,
            wins=0,
            draws=0,
            losses=0,
            gf=0,
            ga=0,
            gd=0,
            points=0,
            placement_points=0,
            kill_points=0,
        )
        for p in participants
    }
    tournament = db.get(Tournament, tournament_id)
    query = select(Match).where(
        Match.tournament_id == tournament_id,
        Match.status.in_(["completed", "walkover"]),
    )
    if group_id:
        query = query.where(Match.group_id == group_id)
    for m in db.scalars(query):
        if tournament.game == "pubg":
            for r in db.scalars(
                select(PubgMatchResult).where(PubgMatchResult.match_id == m.id)
            ):
                if r.participant_id not in rows:
                    continue
                row = rows[r.participant_id]
                row["played"] += 1
                row["wins"] += int(r.placement == 1)
                row["losses"] += int(r.placement != 1)
                row["placement_points"] += r.placement_points
                row["kill_points"] += r.kill_points
                row["points"] += r.total
        elif m.home_id in rows and m.away_id in rows:
            for pid, goals, conceded in [
                (m.home_id, m.home_score or 0, m.away_score or 0),
                (m.away_id, m.away_score or 0, m.home_score or 0),
            ]:
                row = rows[pid]
                row["played"] += 1
                row["gf"] += goals
                row["ga"] += conceded
                row["gd"] = row["gf"] - row["ga"]
                if m.winner_id == pid:
                    row["wins"] += 1
                    row["points"] += 3
                elif m.winner_id:
                    row["losses"] += 1
                else:
                    row["draws"] += 1
                    row["points"] += 1
    # Stable, published tiebreak: points, goal difference/kills, goals/wins, name.
    return sorted(
        rows.values(),
        key=lambda r: (
            -r["points"],
            -(r["kill_points"] if tournament.game == "pubg" else r["gd"]),
            -r["gf"],
            -r["wins"],
            r["name"].lower(),
        ),
    )


def rebuild_standings(db, tid):
    db.flush()
    db.execute(delete(Standing).where(Standing.tournament_id == tid))
    for r in standings(db, tid):
        db.add(
            Standing(
                tournament_id=tid,
                **{
                    k: v
                    for k, v in r.items()
                    if k not in {"name", "player_id", "team_id", "gd"}
                },
            )
        )


def generate_knockout(db, tournament, ids, interval):
    double = tournament.format == "double_elimination"
    require(len(ids) >= 2, "At least two participants are needed")
    size = 1 << (len(ids) - 1).bit_length()
    require(
        not double or size == len(ids),
        "Double elimination requires a power-of-two field (2, 4, 8, 16, 32, 64, 128)",
    )
    b = Bracket(tournament_id=tournament.id, type=tournament.format)
    db.add(b)
    db.flush()
    # Standard seeded bracket distributes first-round byes among top seeds.
    order = [1, 2]
    while len(order) < size:
        order = [x for seed in order for x in (seed, len(order) * 2 + 1 - seed)]
    slots = [ids[s - 1] if s <= len(ids) else None for s in order]
    levels = []
    n = size
    round_no = 0
    while n >= 2:
        label = {2: "Final", 4: "Semi finals", 8: "Quarter finals"}.get(
            n, f"Round of {n}"
        )
        br = BracketRound(bracket_id=b.id, name=label, number=round_no)
        db.add(br)
        db.flush()
        matches = []
        for i in range(n // 2):
            m = Match(
                tournament_id=tournament.id,
                bracket_round_id=br.id,
                stage="winners" if double else "playoff",
                round=label,
                scheduled_at=tournament.start_date
                + timedelta(minutes=interval * round_no),
                home_id=slots[2 * i] if round_no == 0 else None,
                away_id=slots[2 * i + 1] if round_no == 0 else None,
            )
            db.add(m)
            matches.append(m)
        db.flush()
        if levels:
            for i, previous in enumerate(levels[-1]):
                previous.next_match_id = matches[i // 2].id
                previous.next_slot = "home" if i % 2 == 0 else "away"
        levels.append(matches)
        n //= 2
        round_no += 1
    if double:
        losers = []
        for r in range(2 * (len(levels) - 1)):
            count = size // (2 ** (r // 2 + 2))
            br = BracketRound(
                bracket_id=b.id, name=f"Lower round {r + 1}", number=100 + r
            )
            db.add(br)
            db.flush()
            current = [
                Match(
                    tournament_id=tournament.id,
                    bracket_round_id=br.id,
                    stage="losers",
                    round=br.name,
                    scheduled_at=tournament.start_date
                    + timedelta(minutes=interval * (r + 1)),
                )
                for _ in range(count)
            ]
            db.add_all(current)
            db.flush()
            if losers:
                for i, p in enumerate(losers[-1]):
                    p.next_match_id = current[i if r % 2 else i // 2].id
                    p.next_slot = "home" if r % 2 or i % 2 == 0 else "away"
            losers.append(current)
        if losers:
            for i, m in enumerate(levels[0]):
                m.loser_match_id = losers[0][i // 2].id
                m.loser_slot = "home" if i % 2 == 0 else "away"
            for r in range(1, len(levels)):
                target = losers[2 * r - 1]
                for i, m in enumerate(levels[r]):
                    m.loser_match_id = target[len(target) - 1 - i].id
                    m.loser_slot = "away"
        final_round = BracketRound(bracket_id=b.id, name="Grand final", number=200)
        db.add(final_round)
        db.flush()
        grand = Match(
            tournament_id=tournament.id,
            bracket_round_id=final_round.id,
            stage="grand_final",
            round="Grand final",
            scheduled_at=tournament.start_date
            + timedelta(minutes=interval * (2 * len(levels))),
        )
        db.add(grand)
        db.flush()
        levels[-1][0].next_match_id, levels[-1][0].next_slot = grand.id, "home"
        if losers:
            losers[-1][0].next_match_id, losers[-1][0].next_slot = grand.id, "away"
        else:
            levels[0][0].loser_match_id, levels[0][0].loser_slot = grand.id, "away"
    db.flush()
    for m in levels[0]:
        if bool(m.home_id) != bool(m.away_id):
            m.status, m.winner_id = "walkover", m.home_id or m.away_id
            advance(db, m)


def advance(db, match):
    for target_id, slot, pid in [
        (match.next_match_id, match.next_slot, match.winner_id),
        (
            match.loser_match_id,
            match.loser_slot,
            match.away_id if match.winner_id == match.home_id else match.home_id,
        ),
    ]:
        if target_id and pid:
            target = db.get(Match, target_id)
            require(
                target.status == "scheduled",
                "The next match has already started; progression cannot be changed",
            )
            setattr(target, f"{slot}_id", pid)
    if match.stage == "grand_final" and match.winner_id == match.away_id:
        # Lower bracket champion must beat the undefeated player twice.
        reset = Match(
            tournament_id=match.tournament_id,
            bracket_round_id=match.bracket_round_id,
            stage="reset_final",
            round="Grand final reset",
            home_id=match.home_id,
            away_id=match.away_id,
            scheduled_at=match.scheduled_at + timedelta(minutes=30),
        )
        db.add(reset)
        db.flush()
        match.next_match_id, match.next_slot = reset.id, "home"
    elif not match.next_match_id and match.stage in {
        "playoff",
        "grand_final",
        "reset_final",
    }:
        match.tournament.status = "finished"
        for uid in participant_users(db, match.winner_id):
            notify(
                db,
                uid,
                "Tournament champion",
                f"Congratulations! You won {match.tournament.name}.",
            )


def generate_schedule(db, tournament, data):
    ids = [p.id for p in sorted(tournament.participants, key=lambda p: (p.seed, p.id))]
    require(len(ids) >= 2, "Approve at least two participants first")
    existing = list(
        db.scalars(select(Match).where(Match.tournament_id == tournament.id))
    )
    if data.playoffs:
        require(
            tournament.format == "groups_playoffs",
            "This tournament has no group qualification",
        )
        require(
            existing
            and all(m.status in {"completed", "walkover"} for m in existing)
            and all(m.stage == "group" for m in existing),
            "Complete all group matches before generating playoffs",
        )
        groups = list(
            db.scalars(
                select(Group)
                .where(Group.tournament_id == tournament.id)
                .order_by(Group.name)
            )
        )
        ranked = [
            standings(db, tournament.id, g.id)[: data.qualify_per_group] for g in groups
        ]
        ids = [
            r[i]["participant_id"]
            for i in range(data.qualify_per_group)
            for r in ranked
            if i < len(r)
        ]
        for pid in ids:
            for uid in participant_users(db, pid):
                notify(db, uid, "Qualified for playoffs", tournament.name)
    else:
        require(
            not existing,
            "Matches already exist. Existing schedules are never silently replaced",
        )
    if data.seeds:
        require(
            len(data.seeds) == len(ids) and set(data.seeds) == set(ids),
            "Manual seeds must list each eligible participant exactly once",
            422,
        )
        ids = data.seeds
    elif data.randomize:
        random.SystemRandom().shuffle(ids)
    for i, pid in enumerate(ids):
        db.get(Participant, pid).seed = i + 1
    if tournament.game == "pubg":
        for i in range(data.pubg_rounds):
            db.add(
                Match(
                    tournament_id=tournament.id,
                    stage="battle_royale",
                    round=f"Map {i + 1} · Erangel"
                    if i % 2 == 0
                    else f"Map {i + 1} · Miramar",
                    scheduled_at=tournament.start_date
                    + timedelta(minutes=i * data.interval_minutes),
                )
            )
    elif data.playoffs or tournament.format in {
        "single_elimination",
        "double_elimination",
    }:
        generate_knockout(db, tournament, ids, data.interval_minutes)
    else:
        is_group = tournament.format == "groups_playoffs"
        count = data.group_count if is_group else 1
        require(
            len(ids) >= count * 2, "Each group needs at least two participants", 422
        )
        assignments = (
            data.groups if data.groups else [ids[i::count] for i in range(count)]
        )
        flattened = [x for g in assignments for x in g]
        require(
            len(flattened) == len(ids)
            and set(flattened) == set(ids)
            and all(len(g) >= 2 for g in assignments),
            "Groups must contain every participant exactly once and at least two participants per group",
            422,
        )
        for i, members in enumerate(assignments):
            g = Group(
                tournament_id=tournament.id,
                name=f"Group {chr(65 + i)}" if is_group else "League",
            )
            db.add(g)
            db.flush()
            db.add_all(
                [
                    GroupMember(
                        tournament_id=tournament.id, group_id=g.id, participant_id=p
                    )
                    for p in members
                ]
            )
            for r, pairs in enumerate(round_robin(members)):
                for a, b in pairs:
                    db.add(
                        Match(
                            tournament_id=tournament.id,
                            group_id=g.id,
                            home_id=a,
                            away_id=b,
                            round=f"{g.name} · Round {r + 1}",
                            stage="group" if is_group else "league",
                            scheduled_at=tournament.start_date
                            + timedelta(minutes=r * data.interval_minutes),
                        )
                    )
    tournament.status = "upcoming"
    db.flush()
    rebuild_standings(db, tournament.id)


def confirm_result(db, match, result, user):
    require(
        match.status not in {"completed", "walkover", "cancelled"},
        "This match is already settled or cancelled; results are immutable",
    )
    require(match.home_id and match.away_id, "Both opponents must be assigned")
    side = winner(
        result.home_score,
        result.away_score,
        result.home_penalties,
        result.away_penalties,
        match.stage not in {"group", "league"},
    )
    match.home_score, match.away_score = result.home_score, result.away_score
    match.winner_id = getattr(match, f"{side}_id") if side else None
    match.status = "completed"
    result.state, result.resolved_by = "confirmed", user.id
    if side:
        advance(db, match)
    rebuild_standings(db, match.tournament_id)
    finish_league(db, match.tournament)
    for pid in (match.home_id, match.away_id):
        for uid in participant_users(db, pid):
            notify(
                db,
                uid,
                "Match result confirmed",
                f"{match.home.name} {match.home_score} : {match.away_score} {match.away.name}",
            )
    audit(
        db,
        user,
        "confirm_result",
        "match",
        match.id,
        {"home": match.home_score, "away": match.away_score, "result_id": result.id},
    )


def finish_league(db, tournament):
    if tournament.format not in {"league", "round_robin"}:
        return
    db.flush()
    matches = list(db.scalars(select(Match).where(Match.tournament_id == tournament.id)))
    if matches and all(m.status in {"completed", "walkover", "cancelled"} for m in matches):
        board = standings(db, tournament.id)
        if board and board[0]["played"]:
            tournament.status = "finished"
            for uid in participant_users(db, board[0]["participant_id"]):
                notify(db, uid, "Tournament champion", f"Congratulations! You won {tournament.name}.", f"champion:{tournament.id}:{uid}")
    elif any(m.status in {"completed", "walkover", "live"} for m in matches):
        tournament.status = "live"


def approve_registration(db, registration, status):
    t = db.scalar(
        select(Tournament)
        .where(Tournament.id == registration.tournament_id)
        .with_for_update()
    )
    require(
        registration.status != "approved",
        "Approved registrations cannot be revoked after admission",
    )
    if status == "approved":
        require(
            not db.scalar(select(Match.id).where(Match.tournament_id == t.id)),
            "Registration is locked after scheduling",
        )
        participants = list(
            db.scalars(select(Participant).where(Participant.tournament_id == t.id))
        )
        require(
            len(participants) < t.max_participants,
            "Tournament is full; place this registration on the waitlist",
        )
        if registration.team_id:
            team = db.get(Team, registration.team_id)
            require(
                t.min_team_size <= len(team.members) <= t.max_team_size,
                "Team roster no longer meets tournament size limits",
            )
            roster = {m.player_id for m in team.members}
            for p in participants:
                if p.team:
                    require(
                        not roster.intersection(m.player_id for m in p.team.members),
                        "A player is already registered with another team",
                    )
        db.add(
            Participant(
                tournament_id=t.id,
                player_id=None if registration.team_id else registration.user.player.id,
                team_id=registration.team_id,
                seed=len(participants) + 1,
            )
        )
    registration.status = status
    notify(db, registration.user_id, f"Registration {status}", t.name)
