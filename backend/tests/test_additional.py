from sqlalchemy import select
from app.models.entities import *
from app.services.competition import generate_schedule
from app.schemas.contracts import Schedule
from conftest import login
from test_competition import complete


def test_league_completes_and_notifies_champion(db,field):
    owner,t=field(4,'league')
    generate_schedule(db,t,Schedule())
    for m in list(db.scalars(select(Match).where(Match.tournament_id==t.id))): complete(db,m,owner)
    assert t.status=='finished'
    assert db.scalar(select(Notification.id).where(Notification.title=='Tournament champion'))


def test_manual_match_membership(client,db,field):
    owner,t=field(4,'league')
    headers=login(client,owner.email)
    data={'tournament_id':t.id,'home_id':t.participants[0].id,'away_id':t.participants[1].id,'round':'Round one','scheduled_at':t.start_date.isoformat()}
    r=client.post('/api/matches',headers=headers,json=data)
    assert r.status_code==201,r.text
    data['away_id']=99999
    assert client.post('/api/matches',headers=headers,json=data).status_code==422


def test_telegram_rejects_forgery(client,monkeypatch):
    from app.core.config import settings
    monkeypatch.setattr(settings(),'telegram_bot_token','123456:verification-only-test-token')
    r=client.post('/api/auth/telegram',json={'init_data':'user=%7B%22id%22%3A123%7D&auth_date=123&hash=forged'})
    assert r.status_code==401


def test_telegram_verified_identity(client,monkeypatch):
    import time,json,hashlib,hmac
    from urllib.parse import urlencode
    from app.core.config import settings
    token='123456:verification-only-test-token'
    monkeypatch.setattr(settings(),'telegram_bot_token',token)
    fields={'auth_date':str(int(time.time())),'user':json.dumps({'id':12345678,'first_name':'Verified'})}
    secret=hmac.new(b'WebAppData',token.encode(),hashlib.sha256).digest()
    fields['hash']=hmac.new(secret,'\n'.join(f'{k}={v}' for k,v in sorted(fields.items())).encode(),hashlib.sha256).hexdigest()
    r=client.post('/api/auth/telegram',json={'init_data':urlencode(fields)})
    assert r.status_code==200,r.text
    assert r.json()['user']['nickname']=='player_12345678'


def test_bot_gateway_secret_required(client):
    assert client.post('/api/bot/session',json={'telegram_id':123}).status_code==401
