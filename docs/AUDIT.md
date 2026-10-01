# ARENA upgrade audit — 2026-10-01

Baseline: `b44f8fc`, clean working tree. Existing production architecture: Koyeb Next.js proxy → Render FastAPI → PostgreSQL/Redis. Baseline: 49 backend tests pass. No production environment file, secret, database, or deployed service is modified by this work.

| Area | Finding | Priority |
| --- | --- | --- |
| Registration | CTA only considers status; lacks future/expired/full/personal states | High |
| Timezones | Browser-local input/display differs by device; database uses naive UTC | High |
| Concurrency | User uniqueness exists, team uniqueness absent; new entries do not lock tournament | High |
| Approvals | Server denies changes after approval; UI still offers invalid rejection/waitlist actions | High |
| Errors | API details and validation text shown directly in English | High |
| Media | No metadata model, safe provider policy, publishing or admin workflow | High |
| Auth | JWT required claims unspecified; refresh can collide across tabs; login errors have timing variation | Medium |
| Config | Koyeb proxy is build-time; Docker build hardcodes Compose backend destination | High |
| Teams | No captain editing/roster management; historical stats depend on mutable membership | Medium |
| Profile | Phone is blanked by editing; completeness and own teams missing | Medium |
| Tournament | No edit endpoint or end date; date constraints need shared presentation | High |
| Queries | Per-match proposal/result queries, repeated tournament match loads, full-history ranking projections | Medium |
| Admin | Huge component, duplicate filters, missing media/audit/results sections; lists lack pagination | Medium |
| UI | Repeated CSS overrides, tiny metadata, long Uzbek text overflows, hardcoded featured demo identity | High |
| Mobile | No install manifest; preserve deep links and same-origin authenticated proxy | Medium |
| Notifications | English generated messages; Redis outbox worker is separate from Render web deployment | Medium |
| Testing | No dedicated media, early-registration, timezone, or PostgreSQL concurrency coverage | High |

Implementation strategy: additive models/migrations and API endpoints; preserve existing route contracts, roles, scoring and deployment topology. Never rewrite the initial migration or silently repair production duplicates. Run new migrations against a disposable database and preserve old rows. Separate registration/media/admin components from existing competition UI. No automatic production deployment.
