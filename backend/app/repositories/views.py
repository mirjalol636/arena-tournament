from sqlalchemy import select, func, or_
from app.models.entities import *
from app.services.competition import standings


def iso(value):
    return value.isoformat() + "Z" if value else None


def tournament_view(db, t):
    matches = list(db.scalars(select(Match).where(Match.tournament_id == t.id)))
    return dict(
        id=t.id,
        slug=t.slug,
        name=t.name,
        game=t.game,
        format=t.format,
        mode=t.mode,
        status=t.status,
        description=t.description,
        banner=t.banner,
        logo=t.logo,
        max_participants=t.max_participants,
        participants=len(t.participants),
        prize_pool=t.prize_pool,
        prizes=t.prizes,
        min_team_size=t.min_team_size,
        max_team_size=t.max_team_size,
        start_date=iso(t.start_date),
        registration_start=iso(t.registration_start),
        registration_end=iso(t.registration_end),
        matches=len(matches),
        completed=sum(m.status in {"completed", "walkover"} for m in matches),
        live=sum(m.status == "live" for m in matches),
        rules=t.rules.text if t.rules else "",
        placement_points=t.rules.placement_points if t.rules else {},
        kill_points=t.rules.kill_points if t.rules else 1,
    )


def participant_view(p):
    return dict(
        id=p.id,
        name=p.name,
        seed=p.seed,
        player_id=p.player_id,
        team_id=p.team_id,
        avatar=p.player.avatar if p.player else p.team.logo,
    )


def match_view(db, m):
    proposals = list(
        db.scalars(
            select(MatchResult)
            .where(MatchResult.match_id == m.id)
            .order_by(MatchResult.created_at.desc())
        )
    )
    return dict(
        id=m.id,
        tournament_id=m.tournament_id,
        tournament=m.tournament.name,
        slug=m.tournament.slug,
        game=m.tournament.game,
        home=participant_view(m.home) if m.home else None,
        away=participant_view(m.away) if m.away else None,
        home_score=m.home_score,
        away_score=m.away_score,
        winner_id=m.winner_id,
        status=m.status,
        round=m.round,
        stage=m.stage,
        group_id=m.group_id,
        bracket_round_id=m.bracket_round_id,
        scheduled_at=iso(m.scheduled_at),
        next_match_id=m.next_match_id,
        results=[
            dict(
                id=r.id,
                home_score=r.home_score,
                away_score=r.away_score,
                home_penalties=r.home_penalties,
                away_penalties=r.away_penalties,
                state=r.state,
                submitted_by=r.submitted_by,
            )
            for r in proposals
        ],
        pubg_results=[
            dict(
                participant_id=r.participant_id,
                placement=r.placement,
                kills=r.kills,
                placement_points=r.placement_points,
                kill_points=r.kill_points,
                total=r.total,
            )
            for r in db.scalars(
                select(PubgMatchResult).where(PubgMatchResult.match_id == m.id)
            )
        ],
    )


def player_view(db, p):
    participant_ids = list(
        db.scalars(select(Participant.id).where(Participant.player_id == p.id))
    )
    team_ids = list(
        db.scalars(select(TeamMember.team_id).where(TeamMember.player_id == p.id))
    )
    participant_ids += list(
        db.scalars(select(Participant.id).where(Participant.team_id.in_(team_ids)))
    )
    pubg_results = list(
        db.scalars(
            select(PubgMatchResult).where(
                PubgMatchResult.participant_id.in_(participant_ids)
            )
        )
    )
    placements = {r.match_id: r.placement for r in pubg_results}
    matches = list(
        db.scalars(
            select(Match)
            .where(
                or_(
                    Match.home_id.in_(participant_ids),
                    Match.away_id.in_(participant_ids),
                    Match.id.in_(placements),
                ),
                Match.status.in_(["completed", "walkover"]),
            )
            .order_by(Match.scheduled_at.desc())
        )
    )
    wins = sum(
        m.winner_id in participant_ids or placements.get(m.id) == 1 for m in matches
    )
    draws = sum(m.winner_id is None and m.id not in placements for m in matches)
    titles = sum(
        m.winner_id in participant_ids
        and not m.next_match_id
        and m.stage in {"playoff", "grand_final", "reset_final"}
        for m in matches
    )
    return dict(
        id=p.id,
        username=p.nickname,
        nickname=p.nickname,
        full_name=p.full_name,
        region=p.region,
        avatar=p.avatar,
        game_ids=p.game_ids,
        matches=len(matches),
        wins=wins,
        losses=len(matches) - wins - draws,
        draws=draws,
        win_rate=round(100 * wins / len(matches)) if matches else 0,
        points=wins * 3 + draws,
        titles=titles,
        form=[
            "W"
            if m.winner_id in participant_ids or placements.get(m.id) == 1
            else "D"
            if not m.winner_id and m.id not in placements
            else "L"
            for m in matches[:5]
        ],
        recent_matches=[match_view(db, m) for m in matches[:6]],
        history=[
            tournament_view(db, t)
            for t in db.scalars(
                select(Tournament)
                .join(Participant)
                .where(Participant.id.in_(participant_ids))
                .distinct()
            )
        ],
    )
