"""Telegram gateway. All player and organizer mutations go through the same authorized REST API."""

import asyncio
import os
import logging
import shlex
from datetime import timedelta
from pathlib import Path
import httpx
from aiogram import Bot, Dispatcher, F
from aiogram.filters import Command
from aiogram.types import Message, ReplyKeyboardMarkup, KeyboardButton, WebAppInfo
from redis import Redis
from sqlalchemy import select, or_
from app.db.session import SessionLocal
from app.models.entities import Notification, User, Match, now
from app.services.competition import notify, participant_users

logging.basicConfig(level=logging.INFO)
log = logging.getLogger("arena.telegram")
API = os.getenv("API_INTERNAL_URL", "http://backend:8000")
TOKEN = os.getenv("TELEGRAM_BOT_TOKEN", "")
PUBLIC = os.getenv("PUBLIC_URL", "http://localhost:3000")
SECRET = os.getenv("BOT_API_SECRET", "")
dispatcher = Dispatcher()
keyboard = ReplyKeyboardMarkup(
    keyboard=[
        [KeyboardButton(text="🏆 Tournaments"), KeyboardButton(text="🎮 My Matches")],
        [KeyboardButton(text="📊 Leaderboard"), KeyboardButton(text="👤 Profile")],
    ],
    resize_keyboard=True,
)


async def request(message, method, path, payload=None):
    async with httpx.AsyncClient(base_url=API, timeout=20) as client:
        identity = await client.post(
            "/api/bot/session",
            headers={"X-Bot-Secret": SECRET},
            json={
                "telegram_id": message.from_user.id,
                "username": message.from_user.username,
                "name": message.from_user.full_name,
            },
        )
        identity.raise_for_status()
        token = identity.json()["access_token"]
        response = await client.request(
            method,
            f"/api{path}",
            headers={"Authorization": f"Bearer {token}"},
            json=payload,
        )
        if response.is_error:
            detail = response.json().get("detail", "Request failed")
            raise ValueError(str(detail))
        return response.json() if response.content else None


@dispatcher.message(Command("start", "help"))
async def start(message: Message):
    await message.answer(
        'Welcome to ARENA. Your next competition starts here.\n\n/tournaments — browse tournaments\n/register <slug> [team-id] — register\n/matches — your next matches\n/standings <slug> — tournament table\n/profile — your player profile\n/gameid <efootball|pubg> <ID> — set your game ID\n\nOrganizers:\n/pending — registration queue\n/today — today’s matches\n/approve <registration-id>\n/result <match-id> <home> <away> [home-pens away-pens]\n/broadcast <tournament-id> "title" "message"\n\nSign in on the website to link an existing account before using a new bot profile.',
        reply_markup=keyboard,
    )
    if PUBLIC.startswith("https://"):
        await message.answer(
            "Open your arena",
            reply_markup=ReplyKeyboardMarkup(
                keyboard=[
                    [
                        KeyboardButton(
                            text="Open ARENA",
                            web_app=WebAppInfo(url=PUBLIC + "/telegram"),
                        )
                    ]
                ],
                resize_keyboard=True,
            ),
        )


@dispatcher.message(Command("tournaments"))
@dispatcher.message(F.text == "🏆 Tournaments")
async def tournaments(message: Message):
    data = await request(message, "GET", "/tournaments")
    text = "\n\n".join(
        f"🏆 {t['name']}\n{t['status'].upper()} · {t['participants']}/{t['max_participants']}\n{PUBLIC}/tournaments/{t['slug']}\n/register {t['slug']}"
        for t in data["items"]
    )
    await message.answer(text[:4000] or "No tournaments published yet.")


@dispatcher.message(Command("register"))
async def register(message: Message):
    args = message.text.split()
    if len(args) < 2:
        await message.answer(
            "Use /register <tournament-slug> [team-id]. Set your game ID first with /gameid."
        )
        return
    result = await request(
        message,
        "POST",
        f"/tournaments/{args[1]}/register",
        {"team_id": int(args[2]) if len(args) > 2 else None},
    )
    await message.answer(
        f"Registration {result['status']}. We’ll notify you when the organizer reviews it."
    )


@dispatcher.message(Command("matches"))
@dispatcher.message(F.text == "🎮 My Matches")
async def matches(message: Message):
    rows = await request(message, "GET", "/users/me/matches")
    rows = [m for m in rows if m["status"] in {"scheduled", "live"}]
    await message.answer(
        "\n\n".join(
            f"{m['home']['name'] + ' vs ' + m['away']['name'] if m['home'] and m['away'] else 'PUBG squad lobby'}\n{m['scheduled_at']} (UTC) · {m['round']}\n{m['tournament']}"
            for m in rows
        )[:4000]
        or "No upcoming matches yet."
    )


@dispatcher.message(Command("standings"))
@dispatcher.message(F.text == "📊 Leaderboard")
async def standings(message: Message):
    args = message.text.split()
    path = (
        f"/leaderboard?slug={args[1]}"
        if message.text.startswith("/standings") and len(args) > 1
        else "/leaderboard"
    )
    rows = await request(message, "GET", path)
    await message.answer(
        "\n".join(
            f"{i + 1}. {r.get('name', r.get('nickname'))} — {r['points']} pts"
            for i, r in enumerate(rows[:25])
        )
        or "No standings yet."
    )


@dispatcher.message(Command("profile"))
@dispatcher.message(F.text == "👤 Profile")
async def profile(message: Message):
    me = await request(message, "GET", "/auth/me")
    p = await request(message, "GET", f"/players/{me['nickname']}")
    await message.answer(
        f"{p['nickname']}\n{p['wins']} wins · {p['losses']} losses · {p['win_rate']}% win rate\n{PUBLIC}/players/{p['nickname']}"
    )


@dispatcher.message(Command("gameid"))
async def gameid(message: Message):
    args = message.text.split()
    if len(args) != 3 or args[1] not in {"efootball", "pubg"}:
        await message.answer("Use /gameid efootball YOUR_ID or /gameid pubg YOUR_ID")
        return
    me = await request(message, "GET", "/auth/me")
    p = await request(message, "GET", f"/players/{me['nickname']}")
    p["game_ids"][args[1]] = args[2]
    await request(
        message,
        "PUT",
        "/users/me/profile",
        {k: p[k] for k in ["full_name", "region", "avatar", "game_ids"]},
    )
    await message.answer("Game ID saved. You’re ready to register.")


@dispatcher.message(Command("pending", "today"))
async def pending(message: Message):
    d = await request(message, "GET", "/admin")
    if message.text.startswith("/pending"):
        text = "\n".join(
            f"#{r['id']} {r['name']} · {r['tournament']}"
            for r in d["registrations"]
            if r["status"] == "pending"
        )
    else:
        text = "\n".join(
            f"#{m['id']} {m['round']} · {m['scheduled_at']} · {m['status']}"
            for m in d["matches"]
            if m["scheduled_at"][:10] == now().date().isoformat()
        )
    await message.answer(text[:4000] or "Nothing waiting right now.")


@dispatcher.message(Command("approve"))
async def approve(message: Message):
    args = message.text.split()
    if len(args) != 2:
        await message.answer("Use /approve <registration-id>")
        return
    await request(
        message, "PATCH", f"/registrations/{int(args[1])}", {"status": "approved"}
    )
    await message.answer("Registration approved.")


@dispatcher.message(Command("result"))
async def result(message: Message):
    args = message.text.split()
    if len(args) not in {4, 6}:
        await message.answer(
            "Use /result <match-id> <home-score> <away-score> [home-pens away-pens]"
        )
        return
    payload = {
        "home_score": int(args[2]),
        "away_score": int(args[3]),
        "home_penalties": int(args[4]) if len(args) == 6 else None,
        "away_penalties": int(args[5]) if len(args) == 6 else None,
    }
    r = await request(message, "POST", f"/matches/{int(args[1])}/results", payload)
    await message.answer(f"Result {r['state']}.")


@dispatcher.message(Command("broadcast"))
async def broadcast(message: Message):
    args = shlex.split(message.text)
    if len(args) != 4:
        await message.answer(
            'Use /broadcast <tournament-id> "Title" "Announcement text"'
        )
        return
    await request(
        message,
        "POST",
        "/announcements",
        {"tournament_id": int(args[1]), "title": args[2], "body": args[3]},
    )
    await message.answer("Announcement published and notifications queued.")


@dispatcher.errors()
async def error_handler(event):
    log.warning("Bot operation failed: %s", type(event.exception).__name__)
    if event.update.message:
        await event.update.message.answer(
            str(event.exception)[:500]
            if isinstance(event.exception, ValueError)
            else "Could not complete that request. Please try again shortly."
        )
    return True


async def notifications(bot):
    redis = Redis.from_url(os.environ["REDIS_URL"])
    while True:
        lock = redis.lock("arena:notification-worker", timeout=55, blocking=False)
        acquired = False
        try:
            acquired = lock.acquire()
            if acquired:
                with SessionLocal() as db:
                    upcoming = list(
                        db.scalars(
                            select(Match).where(
                                Match.status == "scheduled",
                                Match.scheduled_at > now(),
                                Match.scheduled_at <= now() + timedelta(minutes=30),
                            )
                        )
                    )
                    for m in upcoming:
                        for pid, opponent in [(m.home_id, m.away), (m.away_id, m.home)]:
                            if pid and opponent:
                                for uid in participant_users(db, pid):
                                    notify(
                                        db,
                                        uid,
                                        "Your match starts soon",
                                        f"Opponent: {opponent.name}. {m.scheduled_at.isoformat()} UTC. {PUBLIC}/tournaments/{m.tournament.slug}",
                                        f"reminder:{m.id}:{uid}",
                                    )
                    db.commit()
                    jobs = (
                        list(
                            db.scalars(
                                select(Notification)
                                .join(User, User.id == Notification.user_id)
                                .where(
                                    Notification.sent == False,
                                    Notification.available_at <= now(),
                                    Notification.attempts < 8,
                                    User.telegram_id.is_not(None),
                                )
                                .order_by(Notification.id)
                                .limit(15)
                            )
                        )
                        if bot
                        else []
                    )
                    for n in jobs:
                        u = db.get(User, n.user_id)
                        try:
                            await bot.send_message(
                                int(u.telegram_id), f"{n.title}\n\n{n.body}"[:4096]
                            )
                            n.sent = True
                        except Exception as exc:
                            log.warning(
                                "Notification %s failed: %s", n.id, type(exc).__name__
                            )
                            n.attempts += 1
                            n.available_at = now() + timedelta(
                                seconds=min(3600, 2**n.attempts * 15)
                            )
                        db.commit()
        except Exception:
            log.exception("Notification worker failed")
        finally:
            if acquired:
                try:
                    lock.release()
                except Exception:
                    pass
        Path("/tmp/arena-bot-heartbeat").touch()
        await asyncio.sleep(20)


async def main():
    if not TOKEN or not SECRET:
        log.warning(
            "Telegram credentials are absent. Bot is disabled; configure TELEGRAM_BOT_TOKEN and BOT_API_SECRET to activate."
        )
        await notifications(None)
        return
    bot = Bot(TOKEN)
    await asyncio.gather(dispatcher.start_polling(bot), notifications(bot))


if __name__ == "__main__":
    asyncio.run(main())
