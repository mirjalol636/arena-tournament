from datetime import timedelta
import pytest
from sqlalchemy import select,func,event
from sqlalchemy.exc import IntegrityError
from app.models.entities import User,Player,Team,TeamMember,Tournament,Registration,Participant,Media,AuditLog,now
from app.schemas.contracts import TournamentCreate
from app.core.urls import public_https,video_source
from app.services.registration import registration_window
from app.repositories.views import tournament_view,player_view,player_summaries,match_views
from app.core.security import passwords
from conftest import login
from test_participant_management import create_player_user


def media_payload(t=None,**kw):
    return dict(title='Arena highlights',description='Final moments',media_type='highlight',video_url='https://youtu.be/abcdefghijk',thumbnail_url='https://cdn.example.com/thumb.jpg',tournament_id=t.id if t else None,game=t.game if t else None,status='draft',featured=False,**kw)


def test_registration_clock_boundaries(field):
    _,t=field(2)
    assert registration_window(t,t.registration_start-timedelta(microseconds=1))=='not_started'
    assert registration_window(t,t.registration_start)=='open'
    assert registration_window(t,t.registration_end)=='open'
    assert registration_window(t,t.registration_end+timedelta(microseconds=1))=='ended'
    t.status='live';assert registration_window(t)=='closed'
    t.status='finished';assert registration_window(t)=='finished'


@pytest.mark.parametrize('url',['http://youtube.com/watch?v=abcdefghijk','javascript:alert(1)','https://127.0.0.1/a.mp4','https://10.0.0.1/a.mp4','https://localhost/a.mp4','https://secret:pass@example.com/a.mp4','https://api.telegram.org/file/bot123:ABC/test.mp4','https://example.com/v.mp4?token=secret','https://example.com:444/v.mp4','https://youtube.com.evil.com/watch?v=abcdefghijk','https://www.youtube.com/watch?v=bad','https://example.com/embed/123'])
def test_unsafe_video_urls(url):
    with pytest.raises(ValueError):video_source(url)


@pytest.mark.parametrize('url,provider',[('https://www.youtube.com/watch?v=abcdefghijk','youtube'),('https://youtu.be/abcdefghijk','youtube'),('https://youtube.com/shorts/abcdefghijk','youtube'),('https://vimeo.com/123456','vimeo'),('https://cdn.example.com/movie.mp4','file')])
def test_video_providers(url,provider):assert video_source(url)[0]==provider


def test_media_lifecycle_rbac_and_audit(client,db,field):
    owner,t=field(2);h=login(client,owner.email)
    payload=media_payload(t)
    r=client.post('/api/media',headers=h,json=payload);assert r.status_code==201,r.text
    mid=r.json()['id'];assert r.json()['embed_url']=='https://www.youtube-nocookie.com/embed/abcdefghijk'
    assert client.get('/api/media').json()['total']==0
    payload.update(status='published',featured=True)
    assert client.put(f'/api/media/{mid}',headers=h,json=payload).status_code==200
    assert client.get('/api/media?featured=true').json()['items'][0]['id']==mid
    player,_=create_player_user(db,'media-player@arena.test','media_player');db.commit()
    ph=login(client,player.email)
    assert client.post('/api/media',headers=ph,json=payload).status_code==403
    assert client.delete(f'/api/media/{mid}',headers=ph).status_code==403
    assert client.delete(f'/api/media/{mid}',headers=h).status_code==204
    assert client.get('/api/media').json()['total']==0
    assert db.get(Media,mid).status=='archived'
    assert db.scalar(select(func.count()).select_from(AuditLog).where(AuditLog.entity=='media'))==3
    payload['video_url']='javascript:alert(1)'
    assert client.post('/api/media',headers=h,json=payload).status_code==422


def test_manager_media_ownership(client,db,field):
    owner,t=field(2);owner.role='TOURNAMENT_MANAGER';db.commit();h=login(client,owner.email)
    assert client.post('/api/media',headers=h,json=media_payload()).status_code==403
    created=client.post('/api/media',headers=h,json=media_payload(t));assert created.status_code==201
    other,t2=field(2);other.role='TOURNAMENT_MANAGER';db.commit();h2=login(client,other.email)
    assert client.get('/api/admin/media',headers=h2).json()['total']==0
    assert client.put(f"/api/media/{created.json()['id']}",headers=h2,json=media_payload(t2)).status_code==403


def test_private_profile_and_team_edit(client,db,field):
    owner,t=field(2)
    user,p=create_player_user(db,'captain-up@arena.test','captain_up');p.phone='+998901234567';db.commit();h=login(client,user.email)
    assert client.get('/api/users/me/profile',headers=h).json()['phone']==p.phone
    assert 'phone' not in client.get('/api/players/captain_up').json()
    team=client.post('/api/teams',headers=h,json={'name':'New squad'}).json()
    assert client.get('/api/users/me/teams',headers=h).json()[0]['id']==team['id']
    member=t.participants[0].player_id
    r=client.put(f"/api/teams/{team['id']}",headers=h,json={'name':'Changed squad','player_ids':[member]});assert r.status_code==200,r.text
    assert len(r.json()['members'])==2
    stranger=login(client,owner.email)
    assert client.put(f"/api/teams/{team['id']}",headers=stranger,json={'name':'Not mine'}).status_code==403
    db.add(Participant(tournament_id=t.id,team_id=team['id'],seed=3));db.commit()
    assert client.put(f"/api/teams/{team['id']}",headers=h,json={'name':'Locked squad'}).status_code==409


def test_future_registration_state_and_duplicate(client,db,field):
    _,t=field(2);u,p=create_player_user(db,'time-up@arena.test','time_up');db.commit();h=login(client,u.email)
    t.registration_start=now()+timedelta(hours=1);db.commit()
    url=f'/api/tournaments/{t.slug}'
    assert client.get(url+'/registration-state',headers=h).json()['window']=='not_started'
    r=client.post(url+'/register',headers=h,json={});assert r.status_code==409
    assert r.json()['detail']['code']=='registration_not_started'
    t.registration_start=now()-timedelta(days=1);db.commit()
    r=client.post(url+'/register',headers=h,json={});assert r.status_code==201 and r.json()['status']=='waitlist'
    assert client.post(url+'/register',headers=h,json={}).status_code==409
    state=client.get(url+'/registration-state',headers=h).json();assert state['full'] and state['registration']['status']=='waitlist'


def test_draft_visibility_and_utc_edit(client,db,field):
    owner,t=field(2);h=login(client,owner.email)
    data=tournament_view(db,t)
    data.update(status='draft',registration_start='2026-11-01T12:00:00+05:00',registration_end='2026-11-02T12:00:00+05:00',start_date='2026-11-03T12:00:00+05:00',end_date='2026-11-04T12:00:00+05:00')
    r=client.put(f'/api/tournaments/{t.slug}',headers=h,json=data);assert r.status_code==200,r.text
    assert r.json()['registration_start']=='2026-11-01T07:00:00Z'
    assert client.get(f'/api/tournaments/{t.slug}').status_code==404
    assert client.get(f'/api/tournaments/{t.slug}',headers=h).status_code==200
    assert not any(x['id']==t.id for x in client.get('/api/tournaments').json()['items'])
    data['max_participants']=2;data['format']='league'
    assert client.put(f'/api/tournaments/{t.slug}',headers=h,json=data).status_code==409
    data['format']=t.format;data['end_date']='2026-11-01T12:00:00+05:00'
    assert client.put(f'/api/tournaments/{t.slug}',headers=h,json=data).status_code==422


def test_registration_queue_privacy_filters(client,db,field):
    owner,t=field(2);u,p=create_player_user(db,'queue-up@arena.test','queue_up');db.add(Registration(tournament_id=t.id,user_id=u.id,status='pending'));db.commit()
    h=login(client,owner.email)
    assert client.get('/api/admin/registrations?q=queue_up&mode=solo',headers=h).json()['total']==1
    assert client.get('/api/admin/registrations?status=approved',headers=h).json()['total']==0
    assert client.get('/api/admin/registrations',headers=login(client,u.email)).status_code==403
    owner.role='REFEREE';db.commit()
    assert client.get('/api/admin/registrations',headers=h).status_code==403


def test_team_registration_constraint(db,field):
    owner,t=field(2);p=t.participants[0].player
    team=Team(name='Constraint team',captain_id=p.id);db.add(team);db.flush()
    db.add(Registration(tournament_id=t.id,user_id=owner.id,team_id=team.id));db.commit()
    db.add(Registration(tournament_id=t.id,user_id=p.user_id,team_id=team.id))
    with pytest.raises(IntegrityError):db.commit()
    db.rollback()


def test_auth_origin_and_claims(client,db,field):
    import jwt
    from app.core.config import settings
    owner,_=field(2)
    assert client.post('/api/auth/login',headers={'Origin':'https://evil.example'},json={'email':owner.email,'password':'Password2026!'}).status_code==403
    token=jwt.encode({'sub':str(owner.id),'type':'access'},settings().jwt_secret,algorithm='HS256')
    assert client.get('/api/admin',headers={'Authorization':'Bearer '+token}).status_code==401


def test_batched_rankings_match_full_profile(db,field):
    from app.services.competition import generate_schedule
    from app.schemas.contracts import Schedule
    from app.models.entities import Match
    _,t=field(4)
    generate_schedule(db,t,Schedule());db.flush()
    m=db.scalar(select(Match).where(Match.tournament_id==t.id,Match.home_id!=None,Match.away_id!=None))
    # Assign a completed fixture without relying on unrelated progression for this comparison.
    m.status='completed';m.home_score=2;m.away_score=0;m.winner_id=m.home_id;db.commit()
    rows=player_summaries(db,db.scalars(select(Player)))
    for row in rows:
        full=player_view(db,db.get(Player,row['id']))
        for key in ('matches','wins','draws','losses','points','win_rate','form','titles'):assert row[key]==full[key]
