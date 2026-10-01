from sqlalchemy import select, func, or_
from app.models.entities import *
from app.services.competition import standings
from app.services.registration import registration_window


def iso(value):
    return value.isoformat() + "Z" if value else None


def tournament_view(db, t):
    match_count, completed, live = db.execute(select(func.count(Match.id),func.count(Match.id).filter(Match.status.in_(["completed","walkover"])),func.count(Match.id).filter(Match.status=="live")).where(Match.tournament_id==t.id)).one()
    participant_count=db.scalar(select(func.count()).select_from(Participant).where(Participant.tournament_id==t.id))
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
        participants=participant_count,
        registration_window=registration_window(t),
        server_now=iso(now()),
        end_date=iso(t.end_date),
        updated_at=iso(t.updated_at),
        prize_pool=t.prize_pool,
        prizes=t.prizes,
        min_team_size=t.min_team_size,
        max_team_size=t.max_team_size,
        start_date=iso(t.start_date),
        registration_start=iso(t.registration_start),
        registration_end=iso(t.registration_end),
        matches=match_count,
        completed=completed,
        live=live,
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


def match_view(db, m, proposals=None, pubg=None):
    proposals = proposals if proposals is not None else list(
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
            for r in (pubg if pubg is not None else db.scalars(
                select(PubgMatchResult).where(PubgMatchResult.match_id == m.id)
            ))
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
                select(Tournament).where(
                    Tournament.id.in_(
                        select(Participant.tournament_id)
                        .where(Participant.id.in_(participant_ids))
                        .distinct()
                    )
                )
            )
        ],
    )


def match_views(db, query):
    """Bounded eager graph plus two result queries instead of two queries per match."""
    from sqlalchemy.orm import selectinload
    query=query.options(selectinload(Match.tournament),selectinload(Match.home).selectinload(Participant.player),selectinload(Match.home).selectinload(Participant.team),selectinload(Match.away).selectinload(Participant.player),selectinload(Match.away).selectinload(Participant.team))
    rows=list(db.scalars(query))
    if not rows:return []
    ids=[m.id for m in rows]
    proposals={i:[] for i in ids};pubg={i:[] for i in ids}
    for r in db.scalars(select(MatchResult).where(MatchResult.match_id.in_(ids)).order_by(MatchResult.created_at.desc())):proposals[r.match_id].append(r)
    for r in db.scalars(select(PubgMatchResult).where(PubgMatchResult.match_id.in_(ids))):pubg[r.match_id].append(r)
    return [match_view(db,m,proposals[m.id],pubg[m.id]) for m in rows]


def player_summaries(db, players):
    """Fixed query count for roster search/rankings, without serializing full history."""
    from collections import defaultdict
    players=list(players)
    if not players:return []
    ids={p.id for p in players}; team_players=defaultdict(set)
    for m in db.scalars(select(TeamMember).where(TeamMember.player_id.in_(ids))):team_players[m.team_id].add(m.player_id)
    participant_players={}
    for p in db.scalars(select(Participant).where(or_(Participant.player_id.in_(ids),Participant.team_id.in_(team_players)))):
        participant_players[p.id]={p.player_id} if p.player_id else team_players[p.team_id]
    pubg_by_match=defaultdict(list)
    for r in db.scalars(select(PubgMatchResult).where(PubgMatchResult.participant_id.in_(participant_players))):pubg_by_match[r.match_id].append(r)
    data={p.id:dict(matches=0,wins=0,draws=0,titles=0,form=[]) for p in players}
    matches=db.scalars(select(Match).where(Match.status.in_(['completed','walkover']),or_(Match.home_id.in_(participant_players),Match.away_id.in_(participant_players),Match.id.in_(pubg_by_match))).order_by(Match.scheduled_at.desc(),Match.id.desc()))
    for m in matches:
        involved=participant_players.get(m.home_id,set())|participant_players.get(m.away_id,set())
        winners=set(participant_players.get(m.winner_id,set()))
        for r in pubg_by_match[m.id]:
            involved|=participant_players.get(r.participant_id,set())
            if r.placement==1:winners|=participant_players.get(r.participant_id,set())
        for pid in involved:
            d=data[pid];win=pid in winners;draw=m.winner_id is None and not pubg_by_match[m.id]
            d['matches']+=1;d['wins']+=int(win);d['draws']+=int(draw)
            d['titles']+=int(pid in participant_players.get(m.winner_id,set()) and not m.next_match_id and m.stage in {'playoff','grand_final','reset_final'})
            if len(d['form'])<5:d['form'].append('W' if win else 'D' if draw else 'L')
    return [dict(id=p.id,username=p.nickname,nickname=p.nickname,full_name=p.full_name,region=p.region,avatar=p.avatar,game_ids=p.game_ids,**data[p.id],losses=data[p.id]['matches']-data[p.id]['wins']-data[p.id]['draws'],win_rate=round(data[p.id]['wins']*100/data[p.id]['matches']) if data[p.id]['matches'] else 0,points=data[p.id]['wins']*3+data[p.id]['draws'],recent_matches=[],history=[]) for p in players]
