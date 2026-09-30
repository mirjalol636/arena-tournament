# ARENA Tournament Manager

A connected esports tournament platform for eFootball and PUBG Mobile. Next.js 16.3.7, React 19, TypeScript, Tailwind 4, Radix/shadcn-style components, Framer Motion, Geist and Lucide on the frontend; FastAPI, SQLAlchemy 2, Alembic, PostgreSQL, Redis and aiogram 3 on the backend.

## What works

- Public landing page, searchable/filterable tournament directory, live match center, rankings, player and team profiles.
- Tournament overview, participants, matches, calculated groups, horizontally scrolling connected brackets, leaderboard and rules.
- Account creation, Argon2 password hashing, 15-minute JWT access tokens kept in memory, rotating opaque refresh tokens in HttpOnly cookies, logout and server-side role enforcement.
- Solo registration, team/captain registration, game IDs, region/avatar/phone fields, roster creation with substitutes, pending/approved/rejected/waitlist workflows, capacity checks and team overlap checks.
- Organizer dashboard, seven-step tournament wizard, approvals, match creation, scheduling, results, groups, brackets, scoring configuration, announcements and access management.
- Round-robin and league scheduling, manual/random seeding, automatic/manual group allocation, group qualification, single elimination with byes, double elimination including the grand-final reset.
- Player-submitted results, opponent confirmation, disputes, referee/admin adjudication, penalties/extra time, immutable settled scores, standings and bracket progression in one database transaction, audit history.
- PUBG per-map placements and kills, configurable scoring before competition starts, aggregated standings and league completion.
- Telegram commands, verified Mini App login/linking, upcoming-match reminders, retrying notification outbox, and organizer commands using the same permission-checked API.
- Responsive public navigation and mobile bottom navigation, responsive admin sidebar, loading/error/empty states, toasts and confirmation dialogs.

## Repository

```text
frontend/             Next.js app, reusable components, features, hooks, services, types
backend/app/api/      REST endpoints and server-side authorization
backend/app/models/   SQLAlchemy entities and relationships
backend/app/schemas/  Pydantic validation
backend/app/services/ Competition rules, scheduling and progression
backend/app/repositories/ Public response projections
backend/app/core/     Configuration and authentication
backend/app/db/       Engine, sessions, transaction lifecycle
backend/migrations/  Versioned Alembic migrations
backend/tests/        Core and HTTP integration tests
telegram-bot/         aiogram gateway and notification worker
docker-compose.yml   Frontend, backend, bot, PostgreSQL, Redis
```

## Docker startup

Requirements: Docker Engine/Desktop with Compose v2, 4 GB available memory, port 3000 available. Docker was not available on the build machine; container execution remains to be verified on a Docker host.

1. Copy `.env.example` to `.env`.
2. Set `POSTGRES_PASSWORD` to a URL-safe random password and `JWT_SECRET` to an independently generated secret of at least 32 characters. Generate values using `python -c "import secrets; print(secrets.token_urlsafe(48))"`.
3. Start the stack:

```sh
docker compose up -d --build
docker compose ps
docker compose exec backend python -m app.seed
```

The backend applies migrations before starting. Demo data is explicitly seeded only in development and requires `DEMO_PASSWORD`. Re-running the seed does not replace existing tournaments.

- Website: http://localhost:3000
- Admin: http://localhost:3000/admin
- API docs: http://localhost:8000/api/docs
- API health: http://localhost:8000/api/health

PostgreSQL and Redis are not exposed on host ports. Backend port 8000 binds only to loopback. The frontend proxies `/api` to the backend. All five services have health checks and restart policies. Database and Redis data use named volumes.

### Development demo accounts

With the sample `DEMO_PASSWORD=ArenaDemo2026!`:

| Account | Email | Password |
| --- | --- | --- |
| Organizer | `admin@arena.local` | `ArenaDemo2026!` |
| Player | `mirjalol@arena.local` | `ArenaDemo2026!` |
| Player | `sardorbek@arena.local` | `ArenaDemo2026!` |

The password is hashed using the supplied environment value, never hardcoded into application authentication. All eight named demo players use that seed password. Do not seed demo users in production.

The sample dataset contains Andijan eFootball Cup 2026 (completed groups and live semi finals), eFootball Open Series (registration), PUBG Mobile Night League (two scored maps and one live map), and PUBG Mobile Open Qualifier (team registration). PUBG demo lobbies intentionally use two sample squads; real lobbies support up to 128 entrants.

## Local development without Docker

Requirements: Node.js 22+, npm, Python 3.12+. SQLite is supported **only as a development convenience**; production configuration requires PostgreSQL and Redis. Do not use SQLite to validate production concurrency semantics.

```sh
python -m venv .venv
# Windows: .venv\Scripts\Activate.ps1
# macOS/Linux: source .venv/bin/activate
pip install -r backend/requirements.lock
cd backend
# Copy backend/.env.example to backend/.env and set JWT_SECRET.
alembic upgrade head
# Set DEMO_PASSWORD in your shell before running the next command.
python -m app.seed
uvicorn app.main:app --reload --port 8000
```

In another terminal:

```sh
cd frontend
npm ci
npm run dev
```

If port 8000 is unavailable, use another backend port, and set `API_INTERNAL_URL=http://127.0.0.1:YOUR_PORT` in `frontend/.env.local`, then restart Next.js. The preview created during development uses port **8765** for the API and **3000** for the frontend.

`API_INTERNAL_URL` is used by Next.js rewrites at build time; set the correct backend origin when running `npm run build`. The Dockerfile sets it to `http://backend:8000`. No API credentials are embedded in browser bundles.

### Migrations and tests

```sh
cd backend
alembic upgrade head
alembic check
python -m pytest -q
# After an intentional schema change:
alembic revision --autogenerate -m "describe the change"
# Review the migration before applying it.
```

```sh
cd frontend
npm run typecheck
npm run build
```

The backend test suite creates isolated in-memory databases and exercises winner/penalty calculations, round-robin pair coverage, group standings, single-elimination byes, double elimination and reset finals, duplicate schedule rejection, group qualification, registration limits, JWT refresh rotation/replay, CSRF origins, role scoping, result disputes, immutable settled scores, PUBG scoring, manual matches and verified/forged Telegram authentication.

## Competition rules

- eFootball: win = 3 points; draw = 1; loss = 0. Tiebreak order: points, goal difference, goals scored, wins, nickname. Publish a different policy only after implementing it consistently in the standings service.
- PUBG: default placement points = 10, 6, 5, 4, 3, 2, 1, 1; one point per kill. Tiebreak: total points, kill points, wins, team name. A map submission must include every entrant exactly once, with consecutive unique placements.
- Double elimination currently requires a power-of-two approved field. Single elimination supports arbitrary fields through seeded byes. A lower-bracket grand-final victory creates a reset final.
- Groups + playoffs: all group matches must be completed/walkovers before qualification. Top two per group is the UI default; the API accepts a configurable qualifier count.
- Registration freezes after scheduling. Approved entrants cannot be silently removed. Group results cannot be extended after playoff generation.
- Confirmed results are immutable. Referees may resolve/replace pending or disputed proposals before confirmation. Reopening already settled results and cascading downstream rollback are intentionally not exposed.
- Public live views poll every 15 seconds. This implementation does not claim WebSocket streaming.
- Avatar, logo and banner inputs accept HTTPS URLs. Binary media upload/storage is not implemented.

## Roles

| Role | Scope |
| --- | --- |
| SUPER_ADMIN | All tournaments, user role assignment |
| ADMIN | All tournament operations, read user list |
| TOURNAMENT_MANAGER | Own tournaments only |
| REFEREE | Assigned tournament’s match status/results only |
| PLAYER | Own account, captain teams, registration, own results and opposing confirmation |

Permissions are checked server-side on every mutation. The UI is not the security boundary. Referees currently have one explicit tournament assignment. A super administrator cannot demote their own account.

## Telegram

1. Create a bot through Telegram’s BotFather and set `TELEGRAM_BOT_TOKEN` in `.env`.
2. Set a separate random `BOT_API_SECRET` shared only by backend and bot.
3. Set `PUBLIC_URL` to your public HTTPS website and configure the bot’s Mini App domain.
4. Restart backend and bot: `docker compose up -d backend telegram-bot`.
5. Open the bot, use `/start`, then the “Open ARENA” Mini App button. The `/telegram` page verifies the signed `initData` via the server. To link an existing account, sign into that account first in the same Mini App browser session.

Player commands: `/start`, `/help`, `/tournaments`, `/register <slug> [team-id]`, `/gameid <efootball|pubg> <ID>`, `/matches`, `/standings <slug>`, `/profile`.

Organizer commands: `/pending`, `/today`, `/approve <registration-id>`, `/result <match-id> <home> <away> [home-pens away-pens]`, `/broadcast <tournament-id> "title" "message"`.

The bot authenticates Telegram identities through a server-only shared credential; it never trusts a user-entered numeric Telegram ID from the website. Mini App verification checks HMAC and a five-minute expiry. The bot reuses REST authorization for admin commands.

The worker polls a durable database outbox, uses a Redis lock to avoid simultaneous workers, and retries failed sends with exponential delay up to eight attempts. Delivery is at-least-once (a process failure immediately after sending can cause a repeat). Reminders use unique deduplication keys. With Telegram credentials absent, bot polling and external delivery remain disabled; the worker still queues in-app reminders. No live Telegram messages were sent during development.

## Production deployment

Set `ENVIRONMENT=production`, `COOKIE_SECURE=true`, an HTTPS `PUBLIC_URL`, and matching exact `CORS_ORIGINS`. Use PostgreSQL and Redis; production settings reject missing requirements. Terminate HTTPS at your reverse proxy/load balancer. Ensure proxy request-body limits and trusted client-IP handling are configured; application auth throttling keys on its immediate peer address and therefore conservatively shares limits behind the Next.js proxy.

Bootstrap the first real administrator without demo credentials:

```sh
docker compose exec backend python -m app.bootstrap --email organizer@example.com
```

The command prompts for a password, only runs when no super administrator exists, and initializes supported games. Use the admin Settings page for later role changes.

Before a real launch, run the stack on a staging PostgreSQL/Redis host, configure the Telegram token, verify delivery with your own test accounts, configure database backups, log retention and monitoring, and perform a security/load review. This repository is a working implementation; those infrastructure and live-service checks were not possible in the development environment and are not claimed as completed.

### Environment reference

| Variable | Purpose |
| --- | --- |
| DATABASE_URL | SQLAlchemy PostgreSQL URL; SQLite only in local development |
| POSTGRES_PASSWORD | Compose database password; use URL-safe characters |
| JWT_SECRET | At least 32 random characters; unique per environment |
| REDIS_URL | Redis rate limit and worker lock connection |
| ENVIRONMENT | `development` or `production` |
| COOKIE_SECURE | `true` with HTTPS in production |
| CORS_ORIGINS | Comma-separated exact website origins |
| PUBLIC_URL | Website URL used in bot messages |
| API_INTERNAL_URL | Internal backend URL for Next.js build and bot |
| TELEGRAM_BOT_TOKEN | BotFather token; optional for local preview |
| BOT_API_SECRET | Server-to-server bot identity credential |
| DEMO_PASSWORD | Development seed password only |

## Verification record

See [VERIFICATION.md](VERIFICATION.md) for executed checks, known constraints and browser coverage.
