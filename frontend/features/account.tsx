"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import {
  Trophy,
  Shield,
  Gamepad2,
  Medal,
  Bell,
  Users,
  Check,
  Send,
} from "lucide-react";
import { toast } from "sonner";
import { Shell, Logo } from "@/components/shell";
import { useAuth } from "@/components/auth-provider";
import { Button } from "@/components/ui/button";
import {
  Avatar,
  StatCard,
  MatchCard,
  TournamentCard,
  Loading,
  ErrorState,
  Empty,
  Badge,
} from "@/components/competition";
import { useApi } from "@/hooks/use-api";
import { mutate } from "@/services/api";
import type { Player, Team, Registration } from "@/types";
import { gameName } from "@/lib/utils";

export function LoginPage() {
  const [signup, setSignup] = useState(false),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    auth = useAuth(),
    router = useRouter();
  return (
    <Shell>
      <div className="auth-layout">
        <div className="auth-story">
          <span className="eyebrow">YANGI BOSQICHGA XUSH KELIBSIZ</span>
          <h1>
            YAXSHI O‘YINCHILAR
            <br />
            KELISHADI.
            <br />
            <span>
              BUYUKLARI ESA
              <br />
              MAYDONGA TUSHADI.
            </span>
          </h1>
          <Trophy size={140} strokeWidth={0.6} />
          <p>Bitta hisob. Barcha turnirlar. Sening arenang.</p>
        </div>
        <div className="auth-card">
          <Logo />
          <h2>{signup ? "Sizning raqobatingiz shu yerdan boshlanadi." : "Qaytganingizdan xursandmiz."}</h2>
          <p>
            {signup
              ? "O‘yinchi hisobingizni yarating."
              : "Hisobingizga kiring va o‘yinga qayting."}
          </p>
          <form
            className="form"
            onSubmit={async (e) => {
              e.preventDefault();
              setBusy(true);
              setError("");
              const f = Object.fromEntries(
                new FormData(e.currentTarget),
              ) as Record<string, string>;
              try {
                if (signup) await auth.signup(f);
                else await auth.login(f.email, f.password);
                router.push("/profile");
              } catch (e) {
                setError((e as Error).message);
              } finally {
                setBusy(false);
              }
            }}
          >
            {signup && (
              <>
                <label>
                  To‘liq ism
                  <input
                    required
                    name="full_name"
                    autoComplete="name"
                    minLength={2}
                  />
                </label>
                <label>
                  Taxallus
                  <input
                    required
                    name="nickname"
                    minLength={2}
                    maxLength={40}
                    pattern="[A-Za-z0-9_-]+"
                    autoComplete="nickname"
                  />
                  <small>Harflar, raqamlar, pastki chiziq va defislar.</small>
                </label>
              </>
            )}
            <label>
              Elektron pochta manzili
              <input
                required
                name="email"
                type="email"
                autoComplete="email"
                placeholder="siz@example.com"
              />
            </label>
            <label>
              Parol
              <input
                required
                name="password"
                type="password"
                minLength={signup ? 10 : 1}
                autoComplete={signup ? "new-password" : "current-password"}
                placeholder={
                  signup ? "Kamida 10 ta belgi" : "Parolingiz"
                }
              />
            </label>
            {error && (
              <p className="form-error" role="alert">
                {error}
              </p>
            )}
            <Button disabled={busy}>
              {busy ? "Iltimos, kuting…" : signup ? "Hisob yaratish" : "Kirish"}
            </Button>
          </form>
          <p className="auth-switch">
            {signup ? "Hisobingiz bormi?" : "ARENAda yangimisiz?"}{" "}
            <button
              onClick={() => {
                setSignup(!signup);
                setError("");
              }}
            >
              {signup ? "Kirish" : "Raqobatga qo‘shiling"}
            </button>
          </p>
        </div>
      </div>
    </Shell>
  );
}

export function PlayerPage({ username }: { username: string }) {
  const r = useApi<Player>(`/players/${username}`),
    p = r.data;
  return (
    <Shell>
      {r.loading ? (
        <Loading />
      ) : r.error ? (
        <ErrorState message={r.error} retry={r.reload} />
      ) : (
        p && (
          <div className="container page">
            <div className="profile-hero">
              <Avatar name={p.nickname} src={p.avatar} size="hero" />
              <div>
                <span className="eyebrow">O‘YINCHI PROFILI · {p.region}</span>
                <h1>{p.nickname}</h1>
                <p>{p.full_name}</p>
                <div className="form-badges">
                  {p.form.map((f, i) => (
                    <span className={f} key={i}>
                      {f === "W" ? "G‘" : f === "L" ? "M" : f === "D" ? "D" : f}
                    </span>
                  ))}
                </div>
              </div>
              <div className="profile-rank">
                <Trophy />
                <strong>{p.points}</strong>
                <span>MUSOBAQA OCHKOLARI</span>
              </div>
            </div>
            <div className="stat-grid">
              <StatCard
                label="O‘tkazilgan o‘yinlar"
                value={p.matches}
                icon={Gamepad2}
              />
              <StatCard label="G‘alaba" value={p.wins} icon={Trophy} />
              <StatCard label="Mag‘lubiyat" value={p.losses} icon={Shield} />
              <StatCard
                label="G‘alaba ko‘rsatkichi"
                value={`${p.win_rate}%`}
                icon={Medal}
              />
            </div>
            <div className="overview-grid">
              <section>
                <div className="section-heading small">
                  <h2>So‘nggi o‘yinlar</h2>
                </div>
                <div className="match-grid">
                  {p.recent_matches.map((m) => (
                    <MatchCard key={m.id} match={m} />
                  ))}
                </div>
                {!p.recent_matches.length && (
                  <Empty
                    title="Sizning tarixingiz hali yozilmoqda"
                    detail="Yakunlangan o‘yinlar shu yerda ko‘rinadi."
                  />
                )}
              </section>
              <aside className="panel prose">
                <Medal className="purple" />
                <h3>Yutuqlar</h3>
                <div className="list-row">
                  <span>Turnir chempionliklari</span>
                  <strong>{p.titles}</strong>
                </div>
                <div className="list-row">
                  <span>G‘alabalar soni</span>
                  <strong>{p.wins}</strong>
                </div>
                <div className="divider" />
                <h3>O‘yin IDlari</h3>
                {Object.entries(p.game_ids).map(([g, id]) => (
                  <div className="list-row" key={g}>
                    <span>{gameName(g)}</span>
                    <code>{id}</code>
                  </div>
                ))}
              </aside>
            </div>
            <div className="section-heading">
              <h2>Turnirlar tarixi</h2>
            </div>
            <div className="tournament-grid">
              {p.history.map((t) => (
                <TournamentCard key={t.id} t={t} />
              ))}
            </div>
          </div>
        )
      )}
    </Shell>
  );
}

export function TeamPage({ id }: { id: string }) {
  const r = useApi<Team>(`/teams/${id}`),
    t = r.data;
  return (
    <Shell>
      {r.loading ? (
        <Loading />
      ) : r.error ? (
        <ErrorState message={r.error} retry={r.reload} />
      ) : (
        t && (
          <div className="container page">
            <div className="profile-hero">
              <Avatar name={t.name} src={t.logo} size="hero" />
              <div>
                <span className="eyebrow">JAMOA PROFILI</span>
                <h1>{t.name}</h1>
                <p>
                  Sardor ·{" "}
                  <Link href={`/players/${t.captain}`}>{t.captain}</Link>
                </p>
              </div>
              <Shield className="page-emblem" />
            </div>
            <div className="stat-grid">
              <StatCard label="O‘yinlar" value={t.matches} />
              <StatCard label="G‘alaba" value={t.wins} />
              <StatCard label="G‘alaba ko‘rsatkichi" value={`${t.win_rate}%`} />
              <StatCard label="Turnir chempionliklari" value={t.titles} />
            </div>
            <div className="section-heading">
              <h2>Jamoa tarkibi</h2>
            </div>
            <div className="participant-grid">
              {t.members.map((m) => (
                <Link
                  key={m.id}
                  href={`/players/${m.name}`}
                  className="participant-card"
                >
                  <Avatar name={m.name} />
                  <div>
                    <strong>{m.name}</strong>
                    <small>
                      {m.id === t.captain_id
                        ? "SARDOR"
                        : m.substitute
                          ? "ZAXIRA"
                          : "ASOSIY TARKIB"}
                    </small>
                  </div>
                </Link>
              ))}
            </div>
            <div className="section-heading">
              <h2>So‘nggi o‘yinlar</h2>
            </div>
            <div className="match-grid">
              {t.recent_matches.map((m) => (
                <MatchCard key={m.id} match={m} />
              ))}
            </div>
            {!t.recent_matches.length && (
              <Empty
                title="Navbatdagi jangga tayyor"
                detail="Jamoangizning o‘zaro o‘yin natijalari shu yerda ko‘rinadi."
              />
            )}
          </div>
        )
      )}
    </Shell>
  );
}

export function ProfilePage() {
  const { user, ready } = useAuth();
  return (
    <Shell>
      <div className="container page">
        {!ready ? (
          <Loading />
        ) : !user ? (
          <div className="sign-in-prompt">
            <Empty
              title="Arenadagi maskaningiz"
              detail="Profilingiz, jamoalaringiz va arizalaringizni boshqarish uchun tizimga kiring."
            />
            <Button asChild>
              <Link href="/login">Kirish</Link>
            </Button>
          </div>
        ) : (
          <ProfileContent nickname={user.nickname} />
        )}
      </div>
    </Shell>
  );
}

function ProfileContent({ nickname }: { nickname: string }) {
  const profile = useApi<Player>(`/players/${nickname}`),
    registrations = useApi<Registration[]>("/registrations"),
    notifications =
      useApi<{ id: number; title: string; body: string; read: boolean }[]>(
        "/notifications",
      ),
    players = useApi<Player[]>("/players");
  const [busy, setBusy] = useState(false),
    [members, setMembers] = useState<number[]>([]),
    [subs, setSubs] = useState<number[]>([]);
  const p = profile.data;
  return (
    <>
      <div className="page-heading">
        <div>
          <span className="eyebrow">SIZNING RAQOBAT MARKAZINGIZ</span>
          <h1>
            Salom, {nickname}
            <span>.</span>
          </h1>
          <p>Ma’lumotlaringizni o‘yinga doim tayyor tuting.</p>
        </div>
        <Button variant="secondary" asChild>
          <Link href={`/players/${nickname}`}>Ommaviy profil</Link>
        </Button>
      </div>
      <div className="account-grid">
        <section className="panel prose">
          <h2>O‘yinchi ma’lumotlari</h2>
          {p && (
            <form
              className="form"
              onSubmit={async (e) => {
                e.preventDefault();
                setBusy(true);
                const f = new FormData(e.currentTarget);
                try {
                  await mutate(
                    "/users/me/profile",
                    {
                      full_name: f.get("name"),
                      region: f.get("region"),
                      avatar: f.get("avatar"),
                      phone: f.get("phone"),
                      game_ids: {
                        efootball: f.get("efootball"),
                        pubg: f.get("pubg"),
                      },
                    },
                    "PUT",
                  );
                  toast.success("Profil yangilandi");
                  void profile.reload();
                } catch (e) {
                  toast.error((e as Error).message);
                } finally {
                  setBusy(false);
                }
              }}
            >
              <div className="form-grid">
                <label>
                  To‘liq ism
                  <input name="name" defaultValue={p.full_name} required />
                </label>
                <label>
                  Hudud
                  <input name="region" defaultValue={p.region} required />
                </label>
                <label>
                  eFootball ID
                  <input name="efootball" defaultValue={p.game_ids.efootball} />
                </label>
                <label>
                  PUBG Mobile ID
                  <input name="pubg" defaultValue={p.game_ids.pubg} />
                </label>
                <label>
                  Avatar rasm havolasi
                  <input
                    name="avatar"
                    type="url"
                    defaultValue={p.avatar}
                    placeholder="https://"
                  />
                </label>
                <label>
                  Telefon (ixtiyoriy)
                  <input name="phone" type="tel" />
                </label>
              </div>
              <Button disabled={busy}>Profilni saqlash</Button>
            </form>
          )}
          <div className="divider" />
          <h3>
            <Send size={18} /> Telegramni ulash
          </h3>
          <p>
            Shaxsingizni tasdiqlash uchun ARENA botining Mini App ilovasini oching.
            Ushbu hisobni ulash uchun avval shu yerda tizimga kiring, so‘ng tasdiqlangan
            Mini App ma’lumotlaridan foydalaning.
          </p>
          <form
            className="form"
            onSubmit={async (e) => {
              e.preventDefault();
              const f = new FormData(e.currentTarget);
              try {
                await mutate("/auth/telegram", {
                  init_data: f.get("init_data"),
                });
                toast.success("Telegram hisobi ulandi");
              } catch (e) {
                toast.error((e as Error).message);
              }
            }}
          >
            <label>
              Tasdiqlangan Mini App ma’lumotlari (initData)
              <textarea
                name="init_data"
                required
                placeholder="Telegram.WebApp.initData"
              />
            </label>
            <Button variant="secondary">Telegramni tasdiqlash va ulash</Button>
          </form>
        </section>
        <section className="panel prose">
          <h2>
            <Bell size={20} /> Xabarlar qutisi
          </h2>
          {notifications.data?.length ? (
            notifications.data.map((n) => (
              <button
                className={`notification ${n.read ? "read" : ""}`}
                key={n.id}
                onClick={async () => {
                  await mutate(`/notifications/${n.id}`, {}, "PATCH");
                  void notifications.reload();
                }}
              >
                <strong>{n.title}</strong>
                <p>{n.body}</p>
                {!n.read && <small>O‘qilgan deb belgilash</small>}
              </button>
            ))
          ) : (
            <Empty
              title="Barcha xabarlar o‘qilgan"
              detail="O‘yin eslatmalari va ro‘yxatdan o‘tish yangilanishlari shu yerda ko‘rinadi."
            />
          )}
          <div className="divider" />
          <h3>Ro‘yxatdan o‘tganlar</h3>
          {registrations.data?.map((r) => (
            <div className="list-row" key={r.id}>
              <span>{r.tournament}</span>
              <Badge status={r.status} />
            </div>
          ))}
        </section>
        <section className="panel prose">
          <h2>
            <Users size={20} /> Jamoangizni yarating
          </h2>
          <p>Siz sardor bo‘lasiz. Ro‘yxatdan o‘tgan o‘yinchilarni tarkibga qo‘shing.</p>
          <form
            className="form"
            onSubmit={async (e) => {
              e.preventDefault();
              setBusy(true);
              const f = new FormData(e.currentTarget);
              try {
                const t = await mutate<Team>("/teams", {
                  name: f.get("name"),
                  logo: f.get("logo"),
                  player_ids: members,
                  substitute_ids: subs,
                });
                toast.success(`${t.name} tayyor`);
                window.location.href = `/teams/${t.id}`;
              } catch (e) {
                toast.error((e as Error).message);
              } finally {
                setBusy(false);
              }
            }}
          >
            <label>
              Jamoa nomi
              <input name="name" minLength={3} required />
            </label>
            <label>
              Jamoa logotipi havolasi
              <input name="logo" type="url" placeholder="https://" />
            </label>
            <div className="roster-picker">
              {players.data
                ?.filter((x) => x.nickname !== nickname)
                .map((x) => (
                  <div className="list-row" key={x.id}>
                    <label className="checkbox">
                      <input
                        type="checkbox"
                        checked={members.includes(x.id)}
                        onChange={(e) =>
                          setMembers(
                            e.target.checked
                              ? [...members, x.id]
                              : members.filter((id) => id !== x.id),
                          )
                        }
                      />
                      {x.nickname}
                    </label>
                    <label className="checkbox">
                      <input
                        type="checkbox"
                        checked={subs.includes(x.id)}
                        onChange={(e) =>
                          setSubs(
                            e.target.checked
                              ? [...subs, x.id]
                              : subs.filter((id) => id !== x.id),
                          )
                        }
                      />
                      Zaxira o‘yinchisi
                    </label>
                  </div>
                ))}
            </div>
            <Button disabled={busy}>Jamoa yaratish</Button>
          </form>
        </section>
      </div>
    </>
  );
}
