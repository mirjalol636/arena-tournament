from datetime import datetime, timezone
from sqlalchemy import String, ForeignKey, UniqueConstraint, Index, JSON, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.db.session import Base


def now():
    return datetime.now(timezone.utc).replace(tzinfo=None)


class Record:
    id: Mapped[int] = mapped_column(primary_key=True)
    created_at: Mapped[datetime] = mapped_column(default=now)
    updated_at: Mapped[datetime] = mapped_column(default=now, onupdate=now)


class User(Record, Base):
    __tablename__ = "users"
    email: Mapped[str] = mapped_column(String(254), unique=True, index=True)
    password_hash: Mapped[str] = mapped_column(String(255))
    role: Mapped[str] = mapped_column(String(32), default="PLAYER")
    telegram_id: Mapped[str | None] = mapped_column(String(32), unique=True)
    telegram_username: Mapped[str | None] = mapped_column(String(64))
    player: Mapped["Player"] = relationship(back_populates="user", uselist=False)


class RefreshToken(Record, Base):
    __tablename__ = "refresh_tokens"
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), index=True)
    digest: Mapped[str] = mapped_column(String(64), unique=True)
    expires_at: Mapped[datetime]
    revoked: Mapped[bool] = mapped_column(default=False)


class Player(Record, Base):
    __tablename__ = "players"
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), unique=True)
    nickname: Mapped[str] = mapped_column(String(40), unique=True, index=True)
    full_name: Mapped[str] = mapped_column(String(120))
    region: Mapped[str] = mapped_column(String(80), default="Uzbekistan")
    avatar: Mapped[str] = mapped_column(String(1000), default="")
    phone: Mapped[str] = mapped_column(String(32), default="")
    game_ids: Mapped[dict] = mapped_column(JSON, default=dict)
    user: Mapped[User] = relationship(back_populates="player")


class Team(Record, Base):
    __tablename__ = "teams"
    name: Mapped[str] = mapped_column(String(80), unique=True)
    logo: Mapped[str] = mapped_column(String(1000), default="")
    captain_id: Mapped[int] = mapped_column(ForeignKey("players.id"))
    members: Mapped[list["TeamMember"]] = relationship(
        back_populates="team", cascade="all, delete-orphan"
    )


class TeamMember(Record, Base):
    __tablename__ = "team_members"
    __table_args__ = (UniqueConstraint("team_id", "player_id"),)
    team_id: Mapped[int] = mapped_column(ForeignKey("teams.id"))
    player_id: Mapped[int] = mapped_column(ForeignKey("players.id"))
    substitute: Mapped[bool] = mapped_column(default=False)
    team: Mapped[Team] = relationship(back_populates="members")
    player: Mapped[Player] = relationship()


class Game(Record, Base):
    __tablename__ = "games"
    slug: Mapped[str] = mapped_column(String(32), unique=True)
    name: Mapped[str] = mapped_column(String(64))


class Tournament(Record, Base):
    __tablename__ = "tournaments"
    slug: Mapped[str] = mapped_column(String(120), unique=True, index=True)
    name: Mapped[str] = mapped_column(String(120))
    game: Mapped[str] = mapped_column(ForeignKey("games.slug"))
    format: Mapped[str] = mapped_column(String(32))
    mode: Mapped[str] = mapped_column(String(10), default="solo")
    status: Mapped[str] = mapped_column(String(24), default="registration", index=True)
    description: Mapped[str] = mapped_column(Text, default="")
    banner: Mapped[str] = mapped_column(String(1000), default="")
    logo: Mapped[str] = mapped_column(String(1000), default="")
    max_participants: Mapped[int] = mapped_column(default=32)
    min_team_size: Mapped[int] = mapped_column(default=4)
    max_team_size: Mapped[int] = mapped_column(default=6)
    prize_pool: Mapped[int] = mapped_column(default=0)
    prizes: Mapped[dict] = mapped_column(JSON, default=dict)
    registration_start: Mapped[datetime] = mapped_column(default=now)
    registration_end: Mapped[datetime]
    start_date: Mapped[datetime]
    owner_id: Mapped[int] = mapped_column(ForeignKey("users.id"))
    rules: Mapped["TournamentRule"] = relationship(
        uselist=False, cascade="all, delete-orphan"
    )
    participants: Mapped[list["Participant"]] = relationship(
        back_populates="tournament"
    )


class TournamentRule(Record, Base):
    __tablename__ = "tournament_rules"
    tournament_id: Mapped[int] = mapped_column(
        ForeignKey("tournaments.id"), unique=True
    )
    text: Mapped[str] = mapped_column(
        Text, default="Respect your opponent. Check in 15 minutes before your match."
    )
    placement_points: Mapped[dict] = mapped_column(
        JSON,
        default=lambda: {
            "1": 10,
            "2": 6,
            "3": 5,
            "4": 4,
            "5": 3,
            "6": 2,
            "7": 1,
            "8": 1,
        },
    )
    kill_points: Mapped[int] = mapped_column(default=1)


class Participant(Record, Base):
    __tablename__ = "tournament_participants"
    __table_args__ = (
        UniqueConstraint("tournament_id", "player_id"),
        UniqueConstraint("tournament_id", "team_id"),
    )
    tournament_id: Mapped[int] = mapped_column(ForeignKey("tournaments.id"), index=True)
    player_id: Mapped[int | None] = mapped_column(ForeignKey("players.id"))
    team_id: Mapped[int | None] = mapped_column(ForeignKey("teams.id"))
    seed: Mapped[int] = mapped_column(default=0)
    tournament: Mapped[Tournament] = relationship(back_populates="participants")
    player: Mapped[Player | None] = relationship()
    team: Mapped[Team | None] = relationship()

    @property
    def name(self):
        return self.player.nickname if self.player else self.team.name


class Registration(Record, Base):
    __tablename__ = "registrations"
    __table_args__ = (UniqueConstraint("tournament_id", "user_id"),)
    tournament_id: Mapped[int] = mapped_column(ForeignKey("tournaments.id"), index=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), index=True)
    team_id: Mapped[int | None] = mapped_column(ForeignKey("teams.id"))
    status: Mapped[str] = mapped_column(String(16), default="pending", index=True)
    tournament: Mapped[Tournament] = relationship()
    user: Mapped[User] = relationship()
    team: Mapped[Team | None] = relationship()


class Group(Record, Base):
    __tablename__ = "groups"
    __table_args__ = (UniqueConstraint("tournament_id", "name"),)
    tournament_id: Mapped[int] = mapped_column(ForeignKey("tournaments.id"), index=True)
    name: Mapped[str] = mapped_column(String(32))
    members: Mapped[list["GroupMember"]] = relationship(cascade="all, delete-orphan")


class GroupMember(Record, Base):
    __tablename__ = "group_members"
    __table_args__ = (UniqueConstraint("tournament_id", "participant_id"),)
    tournament_id: Mapped[int] = mapped_column(ForeignKey("tournaments.id"))
    group_id: Mapped[int] = mapped_column(ForeignKey("groups.id"), index=True)
    participant_id: Mapped[int] = mapped_column(
        ForeignKey("tournament_participants.id")
    )


class Bracket(Record, Base):
    __tablename__ = "brackets"
    tournament_id: Mapped[int] = mapped_column(
        ForeignKey("tournaments.id"), unique=True
    )
    type: Mapped[str] = mapped_column(String(32))


class BracketRound(Record, Base):
    __tablename__ = "bracket_rounds"
    bracket_id: Mapped[int] = mapped_column(ForeignKey("brackets.id"))
    name: Mapped[str] = mapped_column(String(40))
    number: Mapped[int]


class Match(Record, Base):
    __tablename__ = "matches"
    tournament_id: Mapped[int] = mapped_column(ForeignKey("tournaments.id"), index=True)
    group_id: Mapped[int | None] = mapped_column(ForeignKey("groups.id"))
    bracket_round_id: Mapped[int | None] = mapped_column(
        ForeignKey("bracket_rounds.id")
    )
    home_id: Mapped[int | None] = mapped_column(
        ForeignKey("tournament_participants.id")
    )
    away_id: Mapped[int | None] = mapped_column(
        ForeignKey("tournament_participants.id")
    )
    winner_id: Mapped[int | None] = mapped_column(
        ForeignKey("tournament_participants.id")
    )
    home_score: Mapped[int | None]
    away_score: Mapped[int | None]
    round: Mapped[str] = mapped_column(String(64), default="Round 1")
    stage: Mapped[str] = mapped_column(String(32), default="group")
    status: Mapped[str] = mapped_column(String(16), default="scheduled", index=True)
    scheduled_at: Mapped[datetime] = mapped_column(default=now, index=True)
    next_match_id: Mapped[int | None] = mapped_column(ForeignKey("matches.id"))
    next_slot: Mapped[str | None] = mapped_column(String(4))
    loser_match_id: Mapped[int | None] = mapped_column(ForeignKey("matches.id"))
    loser_slot: Mapped[str | None] = mapped_column(String(4))
    home: Mapped[Participant | None] = relationship(foreign_keys=[home_id])
    away: Mapped[Participant | None] = relationship(foreign_keys=[away_id])
    tournament: Mapped[Tournament] = relationship()


class MatchResult(Record, Base):
    __tablename__ = "match_results"
    match_id: Mapped[int] = mapped_column(ForeignKey("matches.id"), index=True)
    submitted_by: Mapped[int] = mapped_column(ForeignKey("users.id"))
    home_score: Mapped[int]
    away_score: Mapped[int]
    home_penalties: Mapped[int | None]
    away_penalties: Mapped[int | None]
    extra_time: Mapped[bool] = mapped_column(default=False)
    state: Mapped[str] = mapped_column(String(16), default="pending")
    resolved_by: Mapped[int | None] = mapped_column(ForeignKey("users.id"))


class Standing(Record, Base):
    __tablename__ = "standings"
    __table_args__ = (UniqueConstraint("tournament_id", "participant_id"),)
    tournament_id: Mapped[int] = mapped_column(ForeignKey("tournaments.id"), index=True)
    participant_id: Mapped[int] = mapped_column(
        ForeignKey("tournament_participants.id")
    )
    played: Mapped[int] = mapped_column(default=0)
    wins: Mapped[int] = mapped_column(default=0)
    draws: Mapped[int] = mapped_column(default=0)
    losses: Mapped[int] = mapped_column(default=0)
    gf: Mapped[int] = mapped_column(default=0)
    ga: Mapped[int] = mapped_column(default=0)
    points: Mapped[int] = mapped_column(default=0)
    placement_points: Mapped[int] = mapped_column(default=0)
    kill_points: Mapped[int] = mapped_column(default=0)
    participant: Mapped[Participant] = relationship()


class PubgMatchResult(Record, Base):
    __tablename__ = "pubg_match_results"
    __table_args__ = (
        UniqueConstraint("match_id", "participant_id"),
        UniqueConstraint("match_id", "placement"),
    )
    match_id: Mapped[int] = mapped_column(ForeignKey("matches.id"), index=True)
    participant_id: Mapped[int] = mapped_column(
        ForeignKey("tournament_participants.id")
    )
    placement: Mapped[int]
    kills: Mapped[int]
    placement_points: Mapped[int]
    kill_points: Mapped[int]
    total: Mapped[int]


class Notification(Record, Base):
    __tablename__ = "notifications"
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), index=True)
    title: Mapped[str] = mapped_column(String(200))
    body: Mapped[str] = mapped_column(Text)
    read: Mapped[bool] = mapped_column(default=False)
    sent: Mapped[bool] = mapped_column(default=False)
    attempts: Mapped[int] = mapped_column(default=0)
    available_at: Mapped[datetime] = mapped_column(default=now)
    dedupe_key: Mapped[str | None] = mapped_column(String(128), unique=True)


class Announcement(Record, Base):
    __tablename__ = "announcements"
    tournament_id: Mapped[int] = mapped_column(ForeignKey("tournaments.id"))
    author_id: Mapped[int] = mapped_column(ForeignKey("users.id"))
    title: Mapped[str] = mapped_column(String(200))
    body: Mapped[str] = mapped_column(Text)


class AdminUser(Record, Base):
    __tablename__ = "admin_users"
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), unique=True)
    tournament_id: Mapped[int | None] = mapped_column(ForeignKey("tournaments.id"))


class AuditLog(Record, Base):
    __tablename__ = "audit_logs"
    actor_id: Mapped[int] = mapped_column(ForeignKey("users.id"), index=True)
    action: Mapped[str] = mapped_column(String(64))
    entity: Mapped[str] = mapped_column(String(64))
    entity_id: Mapped[int]
    details: Mapped[dict] = mapped_column(JSON, default=dict)


Index("ix_matches_tournament_status", Match.tournament_id, Match.status)
