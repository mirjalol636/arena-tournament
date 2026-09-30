from sqlalchemy import create_engine, event
from sqlalchemy.orm import DeclarativeBase, sessionmaker
from app.core.config import settings


class Base(DeclarativeBase):
    pass


database_url = settings().database_url

if database_url.startswith("postgresql://"):
    database_url = database_url.replace(
        "postgresql://",
        "postgresql+psycopg://",
        1,
    )

engine = create_engine(
    database_url,
    pool_pre_ping=True,
    connect_args={"check_same_thread": False}
    if database_url.startswith("sqlite")
    else {},
)

if database_url.startswith("sqlite"):

    @event.listens_for(engine, "connect")
    def sqlite_fk(connection, _):
        connection.execute("PRAGMA foreign_keys=ON")


SessionLocal = sessionmaker(engine, expire_on_commit=False)


def get_db():
    with SessionLocal() as session:
        try:
            yield session
        except Exception:
            session.rollback()
            raise