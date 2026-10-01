"""Opt-in PostgreSQL checks. Only an explicitly named loopback test database is allowed."""
import os,uuid
from concurrent.futures import ThreadPoolExecutor
from datetime import timedelta
from threading import Barrier
import pytest
from sqlalchemy import create_engine,select,func,text,inspect
from sqlalchemy.engine import make_url
from sqlalchemy.orm import Session
from alembic import command
from alembic.config import Config
from fastapi import HTTPException
from app.models.entities import User,Player,Game,Tournament,TournamentRule,Registration,Participant,now
from app.schemas.contracts import Register,ReviewRegistration
from app.api.routes import register,review_registration

@pytest.fixture
def pg():
    url=os.environ.get('TEST_POSTGRES_URL')
    if not url:pytest.skip('TEST_POSTGRES_URL not configured; use a disposable local PostgreSQL database')
    parsed=make_url(url)
    assert parsed.host in {'127.0.0.1','localhost'} and parsed.database.startswith('arena_verify'), 'Only a disposable loopback arena_verify database is permitted'
    root=create_engine(url)
    schema='arena_verify_'+uuid.uuid4().hex
    with root.begin() as c:c.execute(text(f'CREATE SCHEMA {schema}'))
    engine=create_engine(url,connect_args={'options':f'-csearch_path={schema}'})
    cfg=Config('alembic.ini')
    with engine.begin() as c:
        cfg.attributes['connection']=c
        command.upgrade(cfg,'3fc1ead4d14d')
    yield engine,cfg
    # The whole cluster is disposable; keep evidence until the local server is stopped.
    engine.dispose();root.dispose()


def seed_old(engine):
    with engine.begin() as c:
        uid=c.execute(User.__table__.insert().values(email='existing@arena.test',password_hash='unchanged-hash',role='SUPER_ADMIN')).inserted_primary_key[0]
        c.execute(Game.__table__.insert().values(slug='efootball',name='eFootball'))
        tid=c.execute(Tournament.__table__.insert().values(name='Existing production-like cup',slug='existing-cup',game='efootball',format='single_elimination',owner_id=uid,registration_start=now()-timedelta(days=1),registration_end=now()+timedelta(days=1),start_date=now()+timedelta(days=2),max_participants=2)).inserted_primary_key[0]
        c.execute(TournamentRule.__table__.insert().values(tournament_id=tid,text='Existing rules'))
    return uid,tid


def migrate(engine,cfg):
    with engine.begin() as c:
        cfg.attributes['connection']=c;command.upgrade(cfg,'head')


def test_postgres_additive_migration_preserves_data(pg):
    engine,cfg=pg;uid,tid=seed_old(engine);migrate(engine,cfg)
    with Session(engine) as db:
        assert db.get(User,uid).password_hash=='unchanged-hash'
        t=db.get(Tournament,tid);assert t.name=='Existing production-like cup' and t.rules.text=='Existing rules' and t.end_date is None
    names={x['name'] for x in inspect(engine).get_unique_constraints('registrations')}
    assert 'uq_registration_tournament_team' in names
    assert 'media' in inspect(engine).get_table_names()
    # Running upgrade a second time must be a no-op.
    migrate(engine,cfg)


def setup_players(engine,count):
    with Session(engine) as db:
        ids=[]
        for i in range(count):
            u=User(email=f'p{i}@arena.test',password_hash='unused');db.add(u);db.flush();db.add(Player(user_id=u.id,nickname=f'player{i}',full_name=f'Player {i}',game_ids={'efootball':'12345'}));ids.append(u.id)
        db.commit();return ids


def test_postgres_simultaneous_duplicate_registration(pg):
    engine,cfg=pg;_,tid=seed_old(engine);migrate(engine,cfg);uid=setup_players(engine,1)[0];barrier=Barrier(2)
    def submit():
        with Session(engine) as db:
            u=db.get(User,uid);barrier.wait(timeout=10)
            try:register('existing-cup',Register(),u,db);return 201
            except HTTPException as e:db.rollback();return e.status_code
    with ThreadPoolExecutor(max_workers=2) as pool:results=list(pool.map(lambda _:submit(),range(2)))
    assert sorted(results)==[201,409]
    with Session(engine) as db:assert db.scalar(select(func.count()).select_from(Registration).where(Registration.tournament_id==tid))==1


def test_postgres_simultaneous_capacity_approval(pg):
    engine,cfg=pg;admin,tid=seed_old(engine);migrate(engine,cfg);ids=setup_players(engine,3)
    with Session(engine) as db:
        regs=[Registration(tournament_id=tid,user_id=i) for i in ids];db.add_all(regs);db.commit();rids=[r.id for r in regs]
    barrier=Barrier(3)
    def approve(rid):
        with Session(engine) as db:
            u=db.get(User,admin);barrier.wait(timeout=10)
            try:review_registration(rid,ReviewRegistration(status='approved'),u,db);return 200
            except HTTPException as e:db.rollback();return e.status_code
    with ThreadPoolExecutor(max_workers=3) as pool:results=list(pool.map(approve,rids))
    assert sorted(results)==[200,200,409]
    with Session(engine) as db:
        assert db.scalar(select(func.count()).select_from(Participant).where(Participant.tournament_id==tid))==2
        assert db.scalar(select(func.count()).select_from(Registration).where(Registration.status=='approved'))==2
