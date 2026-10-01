"""Additive production management APIs; original competition endpoints remain compatible."""
from fastapi import APIRouter, Depends, Query, HTTPException
from sqlalchemy import select, func, or_, delete
from sqlalchemy.orm import selectinload
from app.db.session import get_db
from app.core.security import current_user, staff, authorize
from app.core.urls import video_source
from app.models.entities import Media, Tournament, Registration, Player, User, Team, TeamMember, Participant, Match, AuditLog, Notification, Announcement, now
from app.schemas.contracts import MediaWrite, TournamentEdit, TeamCreate
from app.services.competition import require, audit
from app.services.registration import registration_state,locked_tournament
from app.repositories.views import iso,tournament_view,player_view
from app.api.routes import get_tournament,get_record,team_view,registration_view

router=APIRouter(prefix='/api')


def manager_scope(query,user):
    if user.role not in {'SUPER_ADMIN','ADMIN'}:
        query=query.where(Tournament.owner_id==user.id)
    return query


@router.get('/tournaments/{slug}/registration-state')
def own_state(slug:str,user=Depends(current_user),db=Depends(get_db)):
    return registration_state(db,get_tournament(db,slug),user)


@router.get('/users/me/profile')
def own_profile(user=Depends(current_user),db=Depends(get_db)):
    p=user.player
    require(p is not None,'Player not found',404)
    return {**player_view(db,p),'phone':p.phone,'user_id':user.id,'telegram_id':user.telegram_id,'telegram_username':user.telegram_username}


@router.put('/tournaments/{slug}')
def edit_tournament(slug:str,data:TournamentEdit,user=Depends(staff),db=Depends(get_db)):
    original=get_tournament(db,slug)
    t=locked_tournament(db,original.id)
    authorize(db,user,t)
    if data.expected_updated_at:
        from datetime import timezone
        expected=data.expected_updated_at.astimezone(timezone.utc).replace(tzinfo=None) if data.expected_updated_at.tzinfo else data.expected_updated_at
        require(expected==t.updated_at,'Tournament was changed by another organizer. Reload before saving.')
    count=db.scalar(select(func.count()).select_from(Participant).where(Participant.tournament_id==t.id))
    has_matches=bool(db.scalar(select(Match.id).where(Match.tournament_id==t.id)))
    has_entries=bool(db.scalar(select(Registration.id).where(Registration.tournament_id==t.id)))
    require(data.max_participants>=count,'Capacity cannot be smaller than admitted participants',422)
    if count or has_matches or has_entries:
        require((data.game,data.mode,data.format)==(t.game,t.mode,t.format),'Game, mode and format are locked after entries exist')
    if data.status=='finished':
        require(not db.scalar(select(Match.id).where(Match.tournament_id==t.id,Match.status.notin_(['completed','walkover','cancelled']))),'Finish all matches before closing the tournament')
    if has_matches:
        require(data.status!='registration','Registration is locked after scheduling')
    values=data.model_dump(exclude={'rules','expected_updated_at','slug'})
    for key,value in values.items(): setattr(t,key,value)
    if data.slug and data.slug!=t.slug:
        require(not count and not has_entries and not has_matches,'Slug is locked after entries exist')
        require(not db.scalar(select(Tournament.id).where(Tournament.slug==data.slug)),'Tournament slug already exists')
        t.slug=data.slug
    t.rules.text=data.rules
    audit(db,user,'update_tournament','tournament',t.id,{'fields':list(values)})
    db.commit()
    return tournament_view(db,t)


@router.put('/teams/{team_id}')
def edit_team(team_id:int,data:TeamCreate,user=Depends(current_user),db=Depends(get_db)):
    t=db.scalar(select(Team).where(Team.id==team_id).with_for_update().execution_options(populate_existing=True))
    require(t is not None,'Team not found',404)
    require(user.player and t.captain_id==user.player.id,'Only the team captain can manage this team',403)
    ids=set([t.captain_id,*data.player_ids,*data.substitute_ids])
    require(len(ids)<=12,'Teams are limited to 12 members',422)
    desired={(pid,pid in data.substitute_ids and pid!=t.captain_id) for pid in ids}
    existing={(m.player_id,m.substitute) for m in t.members}
    if desired!=existing:
        require(not db.scalar(select(Participant.id).where(Participant.team_id==t.id)),'Roster is locked after tournament admission; create a new squad to preserve match history')
        for pid in ids: get_record(db,Player,pid)
        t.members.clear()
        db.flush()
        t.members=[TeamMember(player_id=pid,substitute=sub) for pid,sub in desired]
    require(not db.scalar(select(Team.id).where(Team.name==data.name,Team.id!=t.id)),'Team name already exists')
    t.name,t.logo=data.name,data.logo
    audit(db,user,'update_team','team',t.id,{'roster_changed':desired!=existing})
    db.commit()
    return team_view(db,t)


def media_view(m):
    provider,embed=video_source(m.video_url)
    return dict(id=m.id,title=m.title,description=m.description,media_type=m.media_type,video_url=m.video_url,thumbnail_url=m.thumbnail_url,tournament_id=m.tournament_id,tournament=m.tournament.name if m.tournament else None,game=m.game,status=m.status,featured=m.featured,created_by=m.created_by,created_at=iso(m.created_at),published_at=iso(m.published_at),provider=provider,embed_url=embed)


def can_edit_media(db,user,m=None,tournament_id=None):
    require(user.role in {'SUPER_ADMIN','ADMIN','TOURNAMENT_MANAGER'},'Organizer access required',403)
    if m and user.role=='TOURNAMENT_MANAGER':
        require(m.created_by==user.id,'You cannot manage this media',403)
        if m.tournament_id: authorize(db,user,get_record(db,Tournament,m.tournament_id))
    if tournament_id: authorize(db,user,get_record(db,Tournament,tournament_id))
    elif user.role=='TOURNAMENT_MANAGER':
        require(False,'Associate media with a tournament you manage',403)


@router.get('/media')
def media(tournament_id:int|None=None,game:str='',featured:bool=False,page:int=Query(1,ge=1),page_size:int=Query(12,ge=1,le=48),db=Depends(get_db)):
    query=select(Media).options(selectinload(Media.tournament)).where(Media.status=='published',Media.published_at<=now(),or_(Media.tournament_id==None,Media.tournament.has(Tournament.status!='draft')))
    if tournament_id: query=query.where(Media.tournament_id==tournament_id)
    if game: query=query.where(Media.game==game)
    if featured: query=query.where(Media.featured==True)
    total=db.scalar(select(func.count()).select_from(query.subquery()))
    return dict(items=[media_view(m) for m in db.scalars(query.order_by(Media.published_at.desc(),Media.id.desc()).offset((page-1)*page_size).limit(page_size))],total=total,page=page)


@router.get('/admin/media')
def admin_media(page:int=Query(1,ge=1),q:str='',user=Depends(staff),db=Depends(get_db)):
    require(user.role in {'SUPER_ADMIN','ADMIN','TOURNAMENT_MANAGER'},'Organizer access required',403)
    query=select(Media).options(selectinload(Media.tournament)).where(Media.title.ilike(f'%{q[:100]}%'))
    if user.role=='TOURNAMENT_MANAGER': query=query.where(Media.created_by==user.id)
    total=db.scalar(select(func.count()).select_from(query.subquery()))
    return dict(items=[media_view(m) for m in db.scalars(query.order_by(Media.id.desc()).offset((page-1)*24).limit(24))],total=total)


@router.post('/media',status_code=201)
def add_media(data:MediaWrite,user=Depends(staff),db=Depends(get_db)):
    can_edit_media(db,user,tournament_id=data.tournament_id)
    if data.tournament_id:
        t=get_record(db,Tournament,data.tournament_id)
        require(not data.game or data.game==t.game,'Media game must match its tournament',422)
    m=Media(**data.model_dump(),created_by=user.id,published_at=now() if data.status=='published' else None)
    db.add(m)
    db.flush()
    audit(db,user,'create_media','media',m.id,{'status':m.status})
    db.commit()
    return media_view(m)


@router.put('/media/{media_id}')
def update_media(media_id:int,data:MediaWrite,user=Depends(staff),db=Depends(get_db)):
    m=get_record(db,Media,media_id)
    can_edit_media(db,user,m,data.tournament_id)
    if data.tournament_id:
        require(not data.game or data.game==get_record(db,Tournament,data.tournament_id).game,'Media game must match its tournament',422)
    for key,value in data.model_dump().items(): setattr(m,key,value)
    if m.status=='published' and not m.published_at: m.published_at=now()
    audit(db,user,'update_media','media',m.id,{'status':m.status})
    db.commit()
    db.refresh(m)
    return media_view(m)


@router.delete('/media/{media_id}',status_code=204)
def archive_media(media_id:int,user=Depends(staff),db=Depends(get_db)):
    m=get_record(db,Media,media_id)
    can_edit_media(db,user,m,m.tournament_id)
    m.status='archived'
    m.featured=False
    audit(db,user,'archive_media','media',m.id)
    db.commit()


@router.get('/admin/audit')
def audit_list(page:int=Query(1,ge=1),user=Depends(staff),db=Depends(get_db)):
    query=select(AuditLog)
    if user.role not in {'SUPER_ADMIN','ADMIN'}: query=query.where(AuditLog.actor_id==user.id)
    total=db.scalar(select(func.count()).select_from(query.subquery()))
    return dict(items=[dict(id=a.id,actor_id=a.actor_id,action=a.action,entity=a.entity,entity_id=a.entity_id,created_at=iso(a.created_at),details=a.details) for a in db.scalars(query.order_by(AuditLog.id.desc()).offset((page-1)*30).limit(30))],total=total)


@router.get('/announcements')
def public_announcements(page:int=Query(1,ge=1),db=Depends(get_db)):
    return [dict(id=a.id,title=a.title,body=a.body,tournament_id=a.tournament_id,created_at=iso(a.created_at)) for a in db.scalars(select(Announcement).join(Tournament).where(Tournament.status!='draft').order_by(Announcement.id.desc()).offset((page-1)*12).limit(12))]


@router.get('/users/me/teams')
def own_teams(user=Depends(current_user),db=Depends(get_db)):
    if not user.player: return []
    return [team_view(db,t) for t in db.scalars(select(Team).join(TeamMember).where(TeamMember.player_id==user.player.id))]


@router.get('/admin/registrations')
def registration_queue(page:int=Query(1,ge=1),status:str='',game:str='',mode:str='',tournament_id:int|None=None,q:str='',user=Depends(staff),db=Depends(get_db)):
    require(user.role!='REFEREE','Organizer access required',403)
    query=select(Registration).join(Tournament).join(User,Registration.user_id==User.id).outerjoin(Player,Player.user_id==User.id).outerjoin(Team,Registration.team_id==Team.id)
    query=manager_scope(query,user)
    if status: query=query.where(Registration.status==status)
    if game: query=query.where(Tournament.game==game)
    if mode: query=query.where(Tournament.mode==mode)
    if tournament_id: query=query.where(Tournament.id==tournament_id)
    if q: query=query.where(or_(Player.nickname.ilike(f'%{q[:80]}%'),Player.full_name.ilike(f'%{q[:80]}%'),Team.name.ilike(f'%{q[:80]}%')))
    total=db.scalar(select(func.count()).select_from(query.subquery()))
    return dict(items=[registration_view(db,r) for r in db.scalars(query.order_by(Registration.created_at.desc(),Registration.id.desc()).offset((page-1)*20).limit(20))],total=total,page=page)
