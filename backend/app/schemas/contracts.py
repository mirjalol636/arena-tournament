from datetime import datetime, timezone
from typing import Literal
from pydantic import BaseModel, Field, field_validator, model_validator


class Login(BaseModel):
    email: str = Field(max_length=254)
    password: str = Field(min_length=1, max_length=128)

    @field_validator("email")
    @classmethod
    def email_valid(cls, v):
        if "@" not in v or "." not in v.split("@")[-1]:
            raise ValueError("Enter a valid email address")
        return v.lower().strip()


class Signup(Login):
    password: str = Field(min_length=10, max_length=128)
    nickname: str = Field(min_length=2, max_length=40, pattern=r"^[A-Za-z0-9_-]+$")
    full_name: str = Field(min_length=2, max_length=120)


class ProfileUpdate(BaseModel):
    full_name: str = Field(min_length=2, max_length=120)
    region: str = Field(min_length=2, max_length=80)
    avatar: str = Field(default="", max_length=1000)
    phone: str = Field(default="", max_length=32)
    game_ids: dict[str, str] = Field(default_factory=dict, max_length=2)

    @field_validator("avatar")
    @classmethod
    def safe_image(cls, v):
        if v and not v.startswith("https://"):
            raise ValueError("Use an HTTPS image URL")
        return v


class TournamentCreate(BaseModel):
    name: str = Field(min_length=4, max_length=120)
    game: Literal["efootball", "pubg"]
    format: Literal[
        "single_elimination",
        "double_elimination",
        "groups_playoffs",
        "league",
        "round_robin",
    ]
    mode: Literal["solo", "team"] = "solo"
    description: str = Field(default="", max_length=5000)
    banner: str = Field(default="", max_length=1000)
    logo: str = Field(default="", max_length=1000)
    max_participants: int = Field(default=32, ge=2, le=128)
    min_team_size: int = Field(default=4, ge=1, le=10)
    max_team_size: int = Field(default=6, ge=1, le=12)
    prize_pool: int = Field(default=0, ge=0, le=100000000)
    prizes: dict[str, int] = Field(default_factory=dict)
    registration_start: datetime
    registration_end: datetime
    start_date: datetime
    rules: str = Field(
        default="Respect your opponent. Check in 15 minutes before your match.",
        max_length=20000,
    )

    @field_validator("registration_start", "registration_end", "start_date")
    @classmethod
    def utc(cls, v):
        return v.astimezone(timezone.utc).replace(tzinfo=None) if v.tzinfo else v

    @field_validator("banner", "logo")
    @classmethod
    def safe_url(cls, v):
        if v and not v.startswith("https://"):
            raise ValueError("Use an HTTPS image URL")
        return v

    @model_validator(mode="after")
    def check(self):
        if not self.registration_start < self.registration_end <= self.start_date:
            raise ValueError(
                "Registration must end after it opens and before the tournament starts"
            )
        if self.min_team_size > self.max_team_size:
            raise ValueError("Minimum team size cannot exceed maximum")
        if (
            any(v < 0 for v in self.prizes.values())
            or sum(self.prizes.values()) > self.prize_pool
        ):
            raise ValueError("Prize allocations must fit the prize pool")
        if self.game == "pubg" and (self.mode != "team" or self.format != "league"):
            raise ValueError("PUBG uses team mode with a league format")
        return self


class Register(BaseModel):
    team_id: int | None = None


class ReviewRegistration(BaseModel):
    status: Literal["approved", "rejected", "waitlist"]


class TeamCreate(BaseModel):
    name: str = Field(min_length=3, max_length=80)
    logo: str = Field(default="", max_length=1000)
    player_ids: list[int] = Field(default_factory=list, max_length=11)
    substitute_ids: list[int] = Field(default_factory=list, max_length=5)

    @field_validator("logo")
    @classmethod
    def safe_url(cls, v):
        if v and not v.startswith("https://"):
            raise ValueError("Use an HTTPS logo URL")
        return v


class Schedule(BaseModel):
    randomize: bool = False
    seeds: list[int] = Field(default_factory=list, max_length=128)
    group_count: int = Field(default=2, ge=1, le=16)
    interval_minutes: int = Field(default=30, ge=5, le=1440)
    pubg_rounds: int = Field(default=4, ge=1, le=20)
    groups: list[list[int]] | None = None
    playoffs: bool = False
    qualify_per_group: int = Field(default=2, ge=1, le=8)


class ResultSubmit(BaseModel):
    home_score: int = Field(ge=0, le=99)
    away_score: int = Field(ge=0, le=99)
    home_penalties: int | None = Field(default=None, ge=0, le=99)
    away_penalties: int | None = Field(default=None, ge=0, le=99)
    extra_time: bool = False

    @model_validator(mode="after")
    def penalties(self):
        if (self.home_penalties is None) != (self.away_penalties is None):
            raise ValueError("Enter both penalty scores")
        if self.home_penalties is not None and (
            self.home_score != self.away_score
            or self.home_penalties == self.away_penalties
        ):
            raise ValueError("Penalties must decide a tied match")
        return self


class ResultDecision(BaseModel):
    state: Literal["confirmed", "disputed"]


class PubgRow(BaseModel):
    participant_id: int
    placement: int = Field(ge=1, le=128)
    kills: int = Field(ge=0, le=100)


class PubgSubmit(BaseModel):
    results: list[PubgRow] = Field(min_length=2, max_length=128)


class Scoring(BaseModel):
    placement_points: dict[str, int] = Field(max_length=128)
    kill_points: int = Field(ge=0, le=100)

    @field_validator("placement_points")
    @classmethod
    def points(cls, values):
        if any(
            not k.isdigit() or not 1 <= int(k) <= 128 or not 0 <= v <= 1000
            for k, v in values.items()
        ):
            raise ValueError("Invalid placement scoring")
        return values


class MatchUpdate(BaseModel):
    status: Literal["scheduled", "live", "cancelled", "walkover"]
    scheduled_at: datetime | None = None
    winner_id: int | None = None


class MatchCreate(BaseModel):
    tournament_id: int
    home_id: int | None = None
    away_id: int | None = None
    group_id: int | None = None
    round: str = Field(min_length=2, max_length=64)
    scheduled_at: datetime

    @field_validator("scheduled_at")
    @classmethod
    def utc(cls, v):
        return v.astimezone(timezone.utc).replace(tzinfo=None) if v.tzinfo else v


class AnnouncementCreate(BaseModel):
    tournament_id: int
    title: str = Field(min_length=3, max_length=200)
    body: str = Field(min_length=3, max_length=4000)


class RoleUpdate(BaseModel):
    role: Literal["SUPER_ADMIN", "ADMIN", "TOURNAMENT_MANAGER", "REFEREE", "PLAYER"]
    tournament_id: int | None = None
