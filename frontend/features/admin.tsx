"use client";
import Link from "next/link";
import { useState} from "react";
import { useRouter } from "next/navigation";
import {
  LayoutDashboard,
  Trophy,
  ClipboardList,
  Users,
  Shield,
  Gamepad2,
  Network,
  GitBranch,
  BarChart3,
  Megaphone,
  Send,
  Settings,
  Plus,

  Check,

  Menu,

  Radio,
  ChevronRight} from "lucide-react";
import { toast } from "sonner";
import { Logo } from "@/components/shell";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/dialog";
import { useAuth } from "@/components/auth-provider";
import {
  Avatar,
  Badge,
  StatCard,
  MatchCard,
  StandingsTable,
  Bracket,
  Loading,
  ErrorState,
  Empty} from "@/components/competition";
import { useApi } from "@/hooks/use-api";
import { mutate } from "@/services/api";
import type { AdminData, Tournament, Match, Player, Team, User, Registration } from "@/types";
import { formatName, date, gameName, money, time, roleLabels } from "@/lib/utils";
import { ResultDialog } from "./tournament";
import { MediaAdmin } from "./media";
import { TournamentEditor } from "./tournament-editor";
import { RegistrationQueue, AuditPanel, NotificationPanel } from "./admin-panels";
import { toUtc, tashkentDay } from "@/lib/utils";
import { MatchEditor } from "./match-editor";

const navigation = [
  { key: "Media", label: "Media", icon: Radio },
  { key: "Results", label: "Natijalar", icon: Trophy },
  { key: "Notifications", label: "Bildirishnomalar", icon: Megaphone },
  { key: "Audit", label: "Amallar tarixi", icon: ClipboardList },
  { key: "Overview", label: "Umumiy koвЂrinish", icon: LayoutDashboard },
  { key: "Tournaments", label: "Turnirlar", icon: Trophy },
  { key: "Registrations", label: "RoвЂyxatdan oвЂtganlar", icon: ClipboardList },
  { key: "Players", label: "OвЂyinchilar", icon: Users },
  { key: "Teams", label: "Jamoalar", icon: Shield },
  { key: "Matches", label: "OвЂyinlar", icon: Gamepad2 },
  { key: "Groups", label: "Guruhlar", icon: Network },
  { key: "Brackets", label: "Turnir setkasi", icon: GitBranch },
  { key: "Leaderboard", label: "Reyting", icon: BarChart3 },
  { key: "Announcements", label: "EвЂ™lonlar", icon: Megaphone },
  { key: "Telegram", label: "Telegram", icon: Send },
  { key: "Settings", label: "Sozlamalar", icon: Settings },
] as const;

export function AdminPage() {
  const { user, ready } = useAuth();
  if (!ready) return <Loading />;
  if (!user)
    return (
      <div className="admin-login">
        <Logo />
        <Empty
          title="Boshqaruv markaziga xush kelibsiz"
          detail="Turnirlarni boshqarish uchun tashkilotchi hisobingiz bilan kiring."
        />
        <Button asChild>
          <Link href="/login">Kirish</Link>
        </Button>
      </div>
    );
  if (user.role === "PLAYER")
    return (
      <div className="admin-login">
        <Logo />
        <Empty
          title="Tashkilotchi ruxsati talab qilinadi"
          detail="Administrator hisobingizga turnir menejeri huquqini berishi mumkin."
        />
        <Button asChild>
          <Link href="/tournaments">Turnirlarni koвЂrish</Link>
        </Button>
      </div>
    );
  return <AdminContent />;
}

function AdminContent() {
  const { user } = useAuth(),
    [view, setView] = useState("Overview"),
    [mobile, setMobile] = useState(false),
    [editingTournament, setEditingTournament] = useState<Tournament | null>(null),
    [slug, setSlug] = useState(""),
    [selected, setSelected] = useState<Match | null>(null),
    [pubg, setPubg] = useState<Match | null>(null),
    [confirm, setConfirm] = useState<{
      title: string;
      run: () => Promise<void>;
    } | null>(null),
    [inspectedReg, setInspectedReg] = useState<Registration | null>(null),
    [busy, setBusy] = useState(false),
    [schedule, setSchedule] = useState(false);
  const result = useApi<AdminData>("/admin");
  const d=result.data;
  const active=slug||d?.tournaments.find(x=>x.status==='live')?.slug||d?.tournaments[0]?.slug||'';
  const detail=useApi<Tournament>(active?`/tournaments/${active}`:null),
    players=useApi<Player[]>(view==='Players'?'/players':null),
    teams=useApi<Team[]>(view==='Teams'?'/teams':null),
    users=useApi<User[]>(view==='Settings'?'/admin/users':null);
  const t=detail.data;
  const refresh = async () => {
    await result.reload();
    if (active) await detail.reload();
  };
  const act = async (path: string, data: unknown, method = "POST") => {
    setBusy(true);
    try {
      await mutate(path, data, method);
      toast.success("OвЂzgarishlar saqlandi");
      await refresh();
    } catch (e) {
      toast.error((e as Error).message);
      throw e;
    } finally {
      setBusy(false);
    }
  };
  const selectMatch = (m: Match) =>
    m.game === "pubg" ? setPubg(m) : setSelected(m);
  const currentNav = navigation.find((n) => n.key === view);
  return (
    <div className="admin-layout">
      <TournamentEditor t={editingTournament} close={()=>setEditingTournament(null)} onSaved={()=>void refresh()}/>
      <aside className={`admin-sidebar ${mobile ? "open" : ""}`}>
        <Logo />
        <div className="workspace-label">
          <span className="workspace-icon">A</span>
          <div>
            Arena ish maydoni<small>TASHKILOTCHI BOSHQARUV MARKAZI</small>
          </div>
        </div>
        <span className="sidebar-label">ISH MAYDONI</span>
        <nav>
          {navigation.map(({ key, label, icon: Icon }) => (
            <button
              className={view === key ? "active" : ""}
              key={key}
              onClick={() => {
                setView(key);
                setMobile(false);
                if (!slug && active) setSlug(active);
              }}
            >
              <Icon size={18} />
              {label}
              {key === "Registrations" &&
                !!d?.registrations.filter((r) => r.status === "pending")
                  .length && (
                  <span className="nav-count">
                    {
                      d.registrations.filter((r) => r.status === "pending")
                        .length
                    }
                  </span>
                )}
            </button>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <Link href="/tournaments">
            <Radio size={16} />
            Ommaviy arenani koвЂrish
            <ChevronRight size={14} />
          </Link>
          <div>
            <Avatar name={user?.nickname || "Admin"} size="small" />
            <span>
              {user?.nickname}
              <small>{formatName(user?.role || "")}</small>
            </span>
          </div>
        </div>
      </aside>
      <div className="admin-main">
        <header className="admin-topbar">
          <div>
            <button
              className="mobile-menu icon-button"
              aria-label="Yon panelni ochish"
              onClick={() => setMobile(!mobile)}
            >
              <Menu />
            </button>
            <span>Ish maydoni</span>
            <ChevronRight size={14} />
            <strong>{currentNav?.label || view}</strong>
          </div>
          <div>
            <span className="system-status">
              <span className="live-dot" />
              Arena faol
            </span>
            <Link href="/profile">
              <Avatar name={user?.nickname || "Admin"} size="small" />
            </Link>
          </div>
        </header>
        <div className="admin-content">
          <div className="page-heading">
            <div>
              <span className="eyebrow">
                {view === "Overview"
                  ? "SIZNING TURNIRLARINGIZ. SIZNING NAZORATINGIZ."
                  : "ARENA BOSHQARUV MARKAZI"}
              </span>
              <h1>
                {view === "Overview"
                  ? `Xush kelibsiz, ${user?.nickname}.`
                  : currentNav?.label || view}
              </h1>
              <p>
                {view === "Overview"
                  ? "Bugun arenangizda nimalar sodir boвЂlayotganini koвЂring."
                  : "Musobaqaning har bir qismini nazorat qilib boring."}
              </p>
            </div>
            <Button asChild>
              <Link href="/admin/new">
                <Plus size={18} />
                Turnir yaratish
              </Link>
            </Button>
          </div>
          {result.loading ? (
            <Loading />
          ) : result.error ? (
            <ErrorState message={result.error} retry={result.reload} />
          ) : (
            d && (
              <>
                {view === "Overview" && (
                  <>
                    <section className="admin-hero">
                      <div>
                        <div className="row">
                          <Badge
                            status={
                              d.tournaments.find((x) => x.slug === active)
                                ?.status || "upcoming"
                            }
                          />
                          <span className="eyebrow">ASOSIY TURNIR</span>
                        </div>
                        <h2>
                          {d.tournaments.find((x) => x.slug === active)?.name ||
                            "Navbatdagi turniringiz shu yerdan boshlanadi"}
                        </h2>
                        <div className="row muted">
                          <span>
                            {d.tournaments.find((x) => x.slug === active)
                              ?.participants || 0}{" "}
                            nafar oвЂyinchi
                          </span>
                          <span>В·</span>
                          <span>
                            {d.tournaments.find((x) => x.slug === active)
                              ?.matches || 0}{" "}
                            ta oвЂyin
                          </span>
                          <span>В·</span>
                          <span>
                            {formatName(
                              d.tournaments.find((x) => x.slug === active)
                                ?.format || "Bellashuvga tayyor",
                            )}
                          </span>
                        </div>
                        <div className="admin-progress">
                          <div className="progress-track">
                            <span
                              style={{
                                width: `${((d.tournaments.find((x) => x.slug === active)?.completed || 0) / Math.max(d.tournaments.find((x) => x.slug === active)?.matches || 1, 1)) * 100}%`,
                              }}
                            />
                          </div>
                          <span>
                            {d.tournaments.find((x) => x.slug === active)
                              ?.completed || 0}{" "}
                            ta yakunlandi
                          </span>
                        </div>
                        <Button
                          variant="secondary"
                          onClick={() => {
                            setSlug(active || "");
                            setView("Matches");
                          }}
                        >
                          Turnirni boshqarish
                        </Button>
                      </div>
                      <Trophy strokeWidth={0.8} />
                    </section>
                    <div className="stat-grid">
                      <StatCard
                        label="Faol turnirlar"
                        value={
                          d.tournaments.filter((t) => t.status !== "finished")
                            .length
                        }
                        detail="Ish maydoningiz boвЂyicha"
                        icon={Trophy}
                      />
                      <StatCard
                        label="Kutilayotgan arizalar"
                        value={
                          d.registrations.filter((r) => r.status === "pending")
                            .length
                        }
                        detail="KoвЂrib chiqishingiz kutilmoqda"
                        icon={ClipboardList}
                      />
                      <StatCard
                        label="Bugungi oвЂyinlar"
                        value={
                          d.matches.filter(
                            (m) =>
                              tashkentDay(m.scheduled_at) ===
                              tashkentDay(new Date()),
                          ).length
                        }
                        detail="Navbatdagi hushtakka tayyor"
                        icon={Gamepad2}
                      />
                      <StatCard
                        label="RoвЂyxatdan oвЂtgan oвЂyinchilar"
                        value={d.players}
                        detail="Musobaqa ishtirokchilari"
                        icon={Users}
                      />
                    </div>
                    <div className="admin-dashboard-grid">
                      <section>
                        <div className="section-heading small">
                          <h2>Yaqinlashayotgan oвЂyinlar</h2>
                          <button
                            className="text-link"
                            onClick={() => setView("Matches")}
                          >
                            Barchasini koвЂrish
                          </button>
                        </div>
                        <div className="match-grid">
                          {d.matches
                            .filter((m) =>
                              ["live", "scheduled"].includes(m.status),
                            )
                            .slice(0, 2)
                            .map((m) => (
                              <MatchCard
                                key={m.id}
                                match={m}
                                onSelect={selectMatch}
                              />
                            ))}
                        </div>
                        <div className="panel registrations-panel">
                          <div className="panel-heading">
                            <h3>SoвЂnggi roвЂyxatdan oвЂtganlar</h3>
                            <button
                              className="text-link"
                              onClick={() => setView("Registrations")}
                            >
                              Barchasini koвЂrish
                            </button>
                          </div>
                          {d.registrations.slice(0, 4).map((r) => (
                            <div className="registration-row" key={r.id}>
                              <Avatar name={r.name} size="small" />
                              <div>
                                <strong>{r.name}</strong>
                                <small>{r.tournament}</small>
                              </div>
                              <Badge status={r.status} />
                              {r.status === "pending" && (
                                <button
                                  className="approve-button"
                                  title="RoвЂyxatdan oвЂtishni tasdiqlash"
                                  aria-label={`Tasdiqlash: ${r.name}`}
                                  onClick={() =>
                                    setConfirm({
                                      title: "Ushbu ishtirokchini turnirga tasdiqlaysizmi?",
                                      run: () =>
                                        act(
                                          `/registrations/${r.id}`,
                                          { status: "approved" },
                                          "PATCH",
                                        ),
                                    })
                                  }
                                >
                                  <Check size={16} />
                                </button>
                              )}
                            </div>
                          ))}
                        </div>
                      </section>
                      <section className="panel prose activity-panel">
                        {t && (
                          <>
                            <h3>Turnir jadvalidan koвЂrinish</h3>
                            {t.leaderboard.slice(0, 3).map((r, i) => (
                              <Link
                                key={r.participant_id}
                                className="list-row"
                                href={
                                  r.team_id
                                    ? `/teams/${r.team_id}`
                                    : `/players/${r.name}`
                                }
                              >
                                <span>
                                  {i + 1}. {r.name}
                                </span>
                                <strong>{r.points} ochko</strong>
                              </Link>
                            ))}
                            <div className="divider" />
                          </>
                        )}
                        <span className="eyebrow">SOвЂNGGI VOQEALAR</span>
                        <h3>Turnir faoliyati</h3>
                        <div className="timeline">
                          {d.activity.map((a) => (
                            <div key={a.id}>
                              <span />
                              <div>
                                <strong>{formatName(a.action)}</strong>
                                <p>
                                  {formatName(a.entity)} #{a.entity_id}
                                </p>
                                <small>
                                  {date(a.created_at)} В· {time(a.created_at)}
                                </small>
                              </div>
                            </div>
                          ))}
                        </div>
                        <div className="divider" />
                        <h3>Tezkor amallar</h3>
                        <div className="quick-actions">
                          <Button
                            variant="secondary"
                            onClick={() => {
                              setView("Registrations");
                            }}
                          >
                            OвЂyinchilarni tasdiqlash
                          </Button>
                          <Button
                            variant="secondary"
                            onClick={() => {
                              setSlug(active || "");
                              setSchedule(true);
                            }}
                          >
                            OвЂyinlarni yaratish
                          </Button>
                        </div>
                      </section>
                    </div>
                  </>
                )}
                {view === "Media" && <MediaAdmin tournaments={d.tournaments}/>}
                {view === "Audit" && <AuditPanel/>}
                {view === "Notifications" && <NotificationPanel/>}
                {view === "Results" && <div className="match-grid">{d.matches.filter(m=>["completed","disputed","awaiting_confirmation"].includes(m.status)||m.results.some(r=>r.state==="pending")).map(m=><MatchCard key={m.id} match={m} onSelect={selectMatch}/>)}</div>}
                {view === "Tournaments" && (
                  <div className="panel">
                    <div className="table-scroll">
                      <table>
                        <thead>
                          <tr>
                            <th>Turnir</th>
                            <th>OвЂyin</th>
                            <th>Ishtirokchilar</th>
                            <th>Mukofot</th>
                            <th>Holat</th>
                            <th />
                          </tr>
                        </thead>
                        <tbody>
                          {d.tournaments.map((x) => (
                            <tr key={x.id}>
                              <td>
                                <strong>{x.name}</strong>
                                <small>{date(x.start_date)}</small>
                              </td>
                              <td>{gameName(x.game)}</td>
                              <td>
                                {x.participants}/{x.max_participants}
                              </td>
                              <td>{money(x.prize_pool)}</td>
                              <td>
                                <Badge status={x.status} />
                              </td>
                              <td>
                                <Button size="sm" variant="ghost" onClick={()=>setEditingTournament(x)}>Tahrirlash</Button>
                                <Button
                                  size="sm"
                                  variant="secondary"
                                  onClick={() => {
                                    setSlug(x.slug);
                                    setView("Matches");
                                  }}
                                >
                                  Boshqarish
                                </Button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
                {view === "Registrations" && <RegistrationQueue tournaments={d.tournaments} onSaved={refresh}/>}
                {["Matches", "Groups", "Brackets", "Leaderboard"].includes(
                  view,
                ) && (
                  <>
                    <div className="management-bar">
                      {t && (
                        <MatchEditor t={t} onSaved={() => void refresh()} />
                      )}
                      <select
                        aria-label="Tanlangan turnir"
                        value={slug}
                        onChange={(e) => setSlug(e.target.value)}
                      >
                        <option value="">Turnirni tanlang</option>
                        {d.tournaments.map((t) => (
                          <option key={t.id} value={t.slug}>
                            {t.name}
                          </option>
                        ))}
                      </select>
                      <Button
                        variant="secondary"
                        disabled={!slug}
                        onClick={() => setSchedule(true)}
                      >
                        <Network size={16} />
                        OвЂyinlarni yaratish
                      </Button>
                      {t && (
                        <Button variant="ghost" asChild>
                          <Link href={`/tournaments/${t.slug}`}>
                            Ommaviy sahifa
                          </Link>
                        </Button>
                      )}
                    </div>
                    {detail.error ? (
                      <ErrorState
                        message={detail.error}
                        retry={detail.reload}
                      />
                    ) : !t ? (
                      <Empty
                        title="Turnirni tanlang"
                        detail="Musobaqani boshqarish uchun yuqoridan turnirni tanlang."
                      />
                    ) : view === "Matches" ? (
                      <div className="admin-matches">
                        {t.match_list.map((m) => (
                          <div key={m.id} className="panel">
                            <MatchCard match={m} onSelect={selectMatch} />
                            <div className="match-actions">
                              <Button
                                size="sm"
                                variant="secondary"
                                onClick={() => selectMatch(m)}
                              >
                                Natijani kiritish / koвЂrish
                              </Button>
                              {["scheduled", "live"].includes(m.status) && (
                                <>
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    disabled={busy}
                                    onClick={() =>
                                      void act(
                                        `/matches/${m.id}`,
                                        {
                                          status:
                                            m.status === "live"
                                              ? "scheduled"
                                              : "live",
                                        },
                                        "PATCH",
                                      ).catch(() => {})
                                    }
                                  >
                                    {m.status === "live"
                                      ? "Jonlini toвЂxtatish"
                                      : "Jonli qilish"}
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    onClick={() =>
                                      setConfirm({
                                        title: "Ushbu oвЂyin bekor qilinsinmi?",
                                        run: () =>
                                          act(
                                            `/matches/${m.id}`,
                                            { status: "cancelled" },
                                            "PATCH",
                                          ),
                                      })
                                    }
                                  >
                                    Bekor qilish
                                  </Button>
                                </>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : view === "Groups" ? (
                      <div className="groups-grid">
                        {t.groups.map((g) => (
                          <div className="panel" key={g.id}>
                            <div className="panel-heading">
                              <h3>{g.name}</h3>
                            </div>
                            <StandingsTable
                              rows={g.standings}
                              game={t.game}
                              qualified={2}
                            />
                          </div>
                        ))}
                      </div>
                    ) : view === "Brackets" ? (
                      <div className="panel bracket-panel">
                        <Bracket
                          matches={t.match_list}
                          onSelect={selectMatch}
                        />
                      </div>
                    ) : (
                      <div className="panel">
                        <StandingsTable rows={t.leaderboard} game={t.game} />
                      </div>
                    )}
                  </>
                )}
                {view === "Players" && (
                  <div className="participant-grid">
                    {players.data?.map((p) => (
                      <Link
                        key={p.id}
                        className="participant-card"
                        href={`/players/${p.nickname}`}
                      >
                        <Avatar name={p.nickname} />
                        <div>
                          <strong>{p.nickname}</strong>
                          <small>
                            {p.region} В· {p.wins} ta gвЂalaba
                          </small>
                        </div>
                      </Link>
                    ))}
                  </div>
                )}
                {view === "Teams" && (
                  <div className="participant-grid">
                    {teams.data?.map((x) => (
                      <Link
                        key={x.id}
                        className="participant-card"
                        href={`/teams/${x.id}`}
                      >
                        <Avatar name={x.name} />
                        <div>
                          <strong>{x.name}</strong>
                          <small>
                            {x.members.length} aвЂ™zo В· {x.captain}
                          </small>
                        </div>
                      </Link>
                    ))}
                  </div>
                )}
                {view === "Announcements" && (
                  <section className="panel prose narrow">
                    <h2>Turnir boвЂyicha eвЂ™lon chop etish</h2>
                    <p>
                      Chop etilgan eвЂ™lonlar turnir sahifasida va roвЂyxatdan oвЂtgan
                      oвЂyinchilarning xabarlar qutisida koвЂrinadi. Ulangan Telegram
                      hisoblariga ham xabarnoma yuboriladi.
                    </p>
                    <form
                      className="form"
                      onSubmit={async (e) => {
                        e.preventDefault();
                        const form = e.currentTarget,
                          f = new FormData(form);
                        try {
                          await act("/announcements", {
                            tournament_id: Number(f.get("tournament")),
                            title: f.get("title"),
                            body: f.get("body"),
                          });
                          form.reset();
                        } catch {}
                      }}
                    >
                      <label>
                        Turnir
                        <select name="tournament" required>
                          {d.tournaments.map((t) => (
                            <option key={t.id} value={t.id}>
                              {t.name}
                            </option>
                          ))}
                        </select>
                      </label>
                      <label>
                        Sarlavha
                        <input
                          name="title"
                          required
                          minLength={3}
                          maxLength={200}
                        />
                      </label>
                      <label>
                        EвЂ™lon matni
                        <textarea
                          name="body"
                          rows={6}
                          minLength={3}
                          maxLength={4000}
                          required
                        />
                      </label>
                      <Button disabled={busy}>EвЂ™lonni chop etish</Button>
                    </form>
                  </section>
                )}
                {view === "Telegram" && (
                  <section className="panel prose narrow">
                    <Send className="purple" size={36} />
                    <h2>Musobaqa, oвЂzaro bogвЂlangan.</h2>
                    <div className="list-row">
                      <span>Bot integratsiyasi</span>
                      <Badge
                        status={
                          d.telegram_configured ? "connected" : "not configured"
                        }
                      />
                    </div>
                    <div className="list-row">
                      <span>Telegram hisobingiz</span>
                      <Badge
                        status={d.telegram_linked ? "linked" : "not linked"}
                      />
                    </div>
                    <p>
                      Bot turnirlarni topish, roвЂyxatdan oвЂtish, turnir jadvali,
                      yaqinlashayotgan oвЂyinlar va profillarni koвЂrishni qoвЂllab-quvvatlaydi.
                      Tashkilotchilar arizalarni tasdiqlashlari, natijalarni kiritishlari
                      va eвЂ™lonlarni chop etishlari mumkin.
                    </p>
                    <div className="command-list">
                      /tournaments В· /register В· /matches В· /standings В·
                      /profile В· /pending В· /approve В· /result В· /broadcast
                    </div>
                    {!d.telegram_configured && (
                      <p>
                        Server muhitida TELEGRAM_BOT_TOKEN va BOT_API_SECRET
                        oвЂzgaruvchilarini sozlang, soвЂng bot servisini ishga tushiring.
                      </p>
                    )}
                    <Button variant="secondary" asChild>
                      <Link href="/profile">Hisobingizni ulang</Link>
                    </Button>
                  </section>
                )}
                {view === "Settings" && (
                  <div className="account-grid">
                    <section className="panel prose">
                      <h2>Ish maydoniga kirish huquqlari</h2>
                      <p>
                        Faqat bosh administratorlar rollarni oвЂzgartirishi mumkin.
                        Hakamlar biriktirilgan turnir doirasida ishlaydi.
                      </p>
                      {users.error && <p>{users.error}</p>}
                      {users.data?.map((u) => (
                        <form
                          className="role-row"
                          key={u.id}
                          onSubmit={(e) => {
                            e.preventDefault();
                            const f = new FormData(e.currentTarget);
                            void act(
                              `/admin/users/${u.id}`,
                              {
                                role: f.get("role"),
                                tournament_id: f.get("tournament")
                                  ? Number(f.get("tournament"))
                                  : null,
                              },
                              "PATCH",
                            ).catch(() => {});
                          }}
                        >
                          <strong>{u.nickname}</strong>
                          <select
                            name="role"
                            defaultValue={u.role}
                            aria-label={`${u.nickname} uchun rol`}
                          >
                            {[
                              "PLAYER",
                              "REFEREE",
                              "TOURNAMENT_MANAGER",
                              "ADMIN",
                              "SUPER_ADMIN",
                            ].map((r) => (
                              <option key={r} value={r}>
                                {roleLabels[r] || r}
                              </option>
                            ))}
                          </select>
                          <select
                            name="tournament"
                            aria-label="Biriktirilgan turnir"
                          >
                            <option value="">Biriktirilmagan</option>
                            {d.tournaments.map((t) => (
                              <option key={t.id} value={t.id}>
                                {t.name}
                              </option>
                            ))}
                          </select>
                          <Button
                            size="sm"
                            variant="secondary"
                            disabled={busy || u.id === user?.id}
                          >
                            Saqlash
                          </Button>
                        </form>
                      ))}
                    </section>
                    <section className="panel prose">
                      <h2>PUBG ochkolari tizimi</h2>
                      <p>Birinchi oвЂyin jonli efirga chiqqanda ochkolar tizimi qulflanadi.</p>
                      <form
                        className="form"
                        onSubmit={(e) => {
                          e.preventDefault();
                          const f = new FormData(e.currentTarget);
                          let points;
                          try {
                            points = JSON.parse(String(f.get("placement")));
                          } catch {
                            toast.error("ToвЂgвЂri JSON oвЂrinlar xaritasini kiriting");
                            return;
                          }
                          void act(
                            `/tournaments/${f.get("slug")}/scoring`,
                            {
                              placement_points: points,
                              kill_points: Number(f.get("kill")),
                            },
                            "PUT",
                          ).catch(() => {});
                        }}
                      >
                        <label>
                          Turnir
                          <select name="slug" required>
                            {d.tournaments
                              .filter((t) => t.game === "pubg")
                              .map((t) => (
                                <option value={t.slug} key={t.id}>
                                  {t.name}
                                </option>
                              ))}
                          </select>
                        </label>
                        <label>
                          OвЂrinlar boвЂyicha ochkolar
                          <textarea
                            name="placement"
                            defaultValue={
                              '{"1":10,"2":6,"3":5,"4":4,"5":3,"6":2,"7":1,"8":1}'
                            }
                          />
                        </label>
                        <label>
                          Har bir kill uchun ochko
                          <input
                            name="kill"
                            type="number"
                            min={0}
                            max={100}
                            defaultValue={1}
                          />
                        </label>
                        <Button disabled={busy}>Ochkolarni saqlash</Button>
                      </form>
                    </section>
                  </div>
                )}
              </>
            )
          )}
        </div>
      </div>
      <ResultDialog
        match={selected}
        close={() => setSelected(null)}
        onSaved={() => void refresh()}
      />
      <Modal
        open={!!inspectedReg}
        onOpenChange={(v) => !v && setInspectedReg(null)}
        title="RoвЂyxatdan oвЂtish maвЂ™lumotlari"
        description="Ishtirokchining batafsil anketasi va qatnashish holati."
      >
        {inspectedReg && (
          <div className="registration-detail-modal" style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
            <div className="list-row">
              <span>Ariza holati</span>
              <Badge status={inspectedReg.status} />
            </div>
            <div className="list-row">
              <span>Turnir</span>
              <strong>{inspectedReg.tournament}</strong>
            </div>
            {inspectedReg.game && (
              <div className="list-row">
                <span>OвЂyin turi</span>
                <strong>{gameName(inspectedReg.game)}</strong>
              </div>
            )}
            <div className="list-row">
              <span>Ishtirokchi nomi</span>
              <strong>{inspectedReg.name}</strong>
            </div>
            {inspectedReg.full_name && (
              <div className="list-row">
                <span>ToвЂliq ism-familiyasi</span>
                <strong>{inspectedReg.full_name}</strong>
              </div>
            )}
            {inspectedReg.nickname && (
              <div className="list-row">
                <span>OвЂyindagi taxallusi (Nick)</span>
                <strong>{inspectedReg.nickname}</strong>
              </div>
            )}
            {inspectedReg.game_id && (
              <div className="list-row">
                <span>OвЂyindagi ID raqami</span>
                <strong>{inspectedReg.game_id}</strong>
              </div>
            )}
            {inspectedReg.phone && (
              <div className="list-row">
                <span>Telefon raqami</span>
                <strong>{inspectedReg.phone}</strong>
              </div>
            )}
            {inspectedReg.telegram_username && (
              <div className="list-row">
                <span>Telegram profili</span>
                <strong>@{inspectedReg.telegram_username.replace(/^@/, "")}</strong>
              </div>
            )}
            {inspectedReg.region && (
              <div className="list-row">
                <span>Mintaqa / Hudud</span>
                <strong>{inspectedReg.region}</strong>
              </div>
            )}
            <div className="list-row">
              <span>Ariza topshirilgan vaqt</span>
              <small>{date(inspectedReg.created_at)}</small>
            </div>

            {inspectedReg.team && (
              <div style={{ marginTop: "10px", paddingTop: "12px", borderTop: "1px solid var(--line)" }}>
                <span className="eyebrow" style={{ display: "block", marginBottom: "8px" }}>JAMOA MAвЂ™LUMOTLARI</span>
                <div className="list-row">
                  <span>Jamoa nomi</span>
                  <strong>{inspectedReg.team.name}</strong>
                </div>
                <div className="list-row">
                  <span>Sardor</span>
                  <strong>{inspectedReg.team.captain}</strong>
                </div>
                {inspectedReg.team.members && inspectedReg.team.members.length > 0 && (
                  <div style={{ marginTop: "10px" }}>
                    <span style={{ fontSize: "11px", color: "var(--muted, #858ca0)", display: "block", marginBottom: "6px" }}>Tarkib roвЂyxati:</span>
                    <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                      {inspectedReg.team.members.map((m, idx) => (
                        <div key={m.id || idx} className="list-row" style={{ padding: "6px 10px", background: "rgba(255,255,255,0.03)", borderRadius: "6px" }}>
                          <span>{idx + 1}. {m.name}</span>
                          <span style={{ fontSize: "11px", color: m.substitute ? "#edc576" : "#83d9b0" }}>
                            {m.substitute ? "Zaxira" : "Asosiy tarkib"}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            <div className="dialog-actions" style={{ marginTop: "18px" }}>
              {inspectedReg.status !== "approved" && (
                <Button
                  onClick={() => {
                    const target = inspectedReg;
                    setConfirm({
                      title: "Ushbu ishtirokchini turnirga tasdiqlaysizmi?",
                      run: async () => {
                        await act(`/registrations/${target.id}`, { status: "approved" }, "PATCH");
                        setInspectedReg(null);
                      },
                    });
                  }}
                >
                  Tasdiqlash
                </Button>
              )}
              {inspectedReg.status !== "waitlist" && (
                <Button
                  variant="secondary"
                  onClick={() => {
                    const target = inspectedReg;
                    setConfirm({
                      title: "Ushbu ishtirokchini kutish roвЂyxatiga oвЂtkazishni xohlaysizmi?",
                      run: async () => {
                        await act(`/registrations/${target.id}`, { status: "waitlist" }, "PATCH");
                        setInspectedReg(null);
                      },
                    });
                  }}
                >
                  Kutish roвЂyxati
                </Button>
              )}
              {inspectedReg.status !== "rejected" && (
                <Button
                  variant="danger"
                  onClick={() => {
                    const target = inspectedReg;
                    setConfirm({
                      title: "Ushbu arizani rad etishni xohlaysizmi?",
                      run: async () => {
                        await act(`/registrations/${target.id}`, { status: "rejected" }, "PATCH");
                        setInspectedReg(null);
                      },
                    });
                  }}
                >
                  Rad etish
                </Button>
              )}
            </div>
          </div>
        )}
      </Modal>
      <Modal
        open={!!confirm}
        onOpenChange={(v) => !v && setConfirm(null)}
        title={confirm?.title || "Amalni tasdiqlash"}
        description="Bu oвЂzgarish turnirda va uning audit tarixida saqlanadi."
      >
        <div className="dialog-actions">
          <Button variant="secondary" onClick={() => setConfirm(null)}>
            Bekor qilish
          </Button>
          <Button
            disabled={busy}
            onClick={async () => {
              try {
                await confirm?.run();
                setConfirm(null);
              } catch {}
            }}
          >
            {busy ? "SaqlanmoqdaвЂ¦" : "OвЂzgarishni tasdiqlash"}
          </Button>
        </div>
      </Modal>
      <Modal
        open={schedule}
        onOpenChange={setSchedule}
        title="Musobaqani shakllantirish"
        description="Saralangan turnir setkasini, aylana tizim jadvalini yoki PUBG lobbilar seriyasini yarating."
      >
        <form
          className="form"
          onSubmit={async (e) => {
            e.preventDefault();
            const f = new FormData(e.currentTarget);
            let groups;
            try {
              groups = f.get("groups")
                ? JSON.parse(String(f.get("groups")))
                : null;
            } catch {
              toast.error(
                "Guruhlar ishtirokchi IDlaridan iborat JSON massivlari boвЂlishi kerak",
              );
              return;
            }
            try {
              await act(`/tournaments/${slug || active}/schedule`, {
                randomize: f.get("random") === "on",
                seeds: String(f.get("seeds") || "")
                  .split(",")
                  .map((x) => Number(x.trim()))
                  .filter(Boolean),
                group_count: Number(f.get("count")),
                interval_minutes: Number(f.get("interval")),
                pubg_rounds: Number(f.get("rounds")),
                playoffs: f.get("playoffs") === "on",
                qualify_per_group: 2,
                groups,
              });
              setSchedule(false);
            } catch {}
          }}
        >
          <label>
            Turnir
            <select
              value={slug || active}
              onChange={(e) => setSlug(e.target.value)}
            >
              {d?.tournaments.map((t) => (
                <option key={t.id} value={t.slug}>
                  {t.name}
                </option>
              ))}
            </select>
          </label>
          <div className="form-grid">
            <label>
              Guruhlar soni
              <input
                type="number"
                min={1}
                max={16}
                defaultValue={2}
                name="count"
              />
            </label>
            <label>
              Bosqichlar orasidagi daqiqalar
              <input
                type="number"
                min={5}
                max={1440}
                defaultValue={30}
                name="interval"
              />
            </label>
            <label>
              PUBG xaritalari soni
              <input
                type="number"
                min={1}
                max={20}
                defaultValue={4}
                name="rounds"
              />
            </label>
          </div>
          <label className="checkbox">
            <input type="checkbox" name="random" />
            Saralash oвЂrinlarini tasodifiy taqsimlash
          </label>
          <label>
            QoвЂlda saralash oвЂrinlari (ixtiyoriy)
            <input name="seeds" placeholder="Ishtirokchi IDlari: 1, 4, 2, 3" />
          </label>
          <label>
            QoвЂlda guruhlar (ixtiyoriy)
            <input name="groups" placeholder="[[1,2,3,4],[5,6,7,8]]" />
          </label>
          {t && (
            <p className="hint">
              {t.participant_list.map((p) => `${p.id}: ${p.name}`).join(" В· ")}
            </p>
          )}
          <label className="checkbox">
            <input type="checkbox" name="playoffs" />
            Yakunlangan guruhlardan pley-offni yaratish (har bir guruhdan 2 tadan)
          </label>
          <p className="hint">
            Mavjud oвЂyinlar saqlanadi. Double elimination uchun ishtirokchilar
            soni 2 ning darajasi boвЂlishi kerak.
          </p>
          <Button disabled={busy}>
            {busy ? "YaratilmoqdaвЂ¦" : "OвЂyinlarni yaratish"}
          </Button>
        </form>
      </Modal>
      <Modal
        open={!!pubg}
        onOpenChange={(v) => !v && setPubg(null)}
        title="PUBG lobbisi natijalari"
        description={pubg?.round}
      >
        {pubg && (
          <PubgForm
            match={pubg}
            save={async (data) => {
              await act(`/matches/${pubg.id}/pubg`, data, "PUT");
              setPubg(null);
            }}
          />
        )}
      </Modal>
    </div>
  );
}

function PubgForm({
  match,
  save,
}: {
  match: Match;
  save: (data: unknown) => Promise<void>;
}) {
  const r = useApi<Tournament>(`/tournaments/${match.slug}`),
    [busy, setBusy] = useState(false);
  return (
    <form
      className="form"
      onSubmit={async (e) => {
        e.preventDefault();
        const f = new FormData(e.currentTarget);
        setBusy(true);
        try {
          await save({
            results: r.data?.participant_list.map((p) => ({
              participant_id: p.id,
              placement: Number(f.get(`p${p.id}`)),
              kills: Number(f.get(`k${p.id}`)),
            })),
          });
        } finally {
          setBusy(false);
        }
      }}
    >
      {r.data?.participant_list.map((p, i) => (
        <div className="pubg-entry" key={p.id}>
          <strong>{p.name}</strong>
          <label>
            OвЂrin
            <input
              name={`p${p.id}`}
              type="number"
              min={1}
              max={r.data?.participants}
              defaultValue={
                match.pubg_results.find((x) => x.participant_id === p.id)
                  ?.placement || i + 1
              }
              required
            />
          </label>
          <label>
            Killlar
            <input
              name={`k${p.id}`}
              type="number"
              min={0}
              max={100}
              defaultValue={
                match.pubg_results.find((x) => x.participant_id === p.id)
                  ?.kills || 0
              }
              required
            />
          </label>
        </div>
      ))}
      <Button disabled={busy || match.status === "completed"}>
        {match.status === "completed"
          ? "Natijalar tasdiqlangan"
          : busy
            ? "SaqlanmoqdaвЂ¦"
            : "Lobbiy natijalarini tasdiqlash"}
      </Button>
    </form>
  );
}

const steps = [
  "Asosiy maвЂ™lumotlar",
  "Format",
  "Ishtirokchilar",
  "OвЂyinlar jadvali",
  "Mukofot jamgвЂarmasi",
  "Qoidalar",
  "Chop etish",
];

export function TournamentWizard() {
  const { user, ready } = useAuth(),
    router = useRouter(),
    [step, setStep] = useState(0),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const [form, setForm] = useState({
    name: "",
    game: "efootball",
    description: "",
    banner: "",
    logo: "",
    format: "groups_playoffs",
    mode: "solo",
    max_participants: 32,
    min_team_size: 4,
    max_team_size: 6,
    registration_start: "",
    registration_end: "",
    start_date: "",
    prize_pool: 0,
    first: 0,
    second: 0,
    third: 0,
    rules:
      "10 daqiqalik oвЂyinlar. Raqibingizni hurmat qiling. OвЂyindan 15 daqiqa oldin tayyor boвЂling. OвЂyinchilar hisoblarni raqib tasdiqlashi uchun yuboradilar. Nizolarni hakamlar hal qiladi.",
  });
  const change = (key: string, value: string | number) =>
    setForm((f) => ({ ...f, [key]: value }));
  if (!ready) return <Loading />;
  if (!user || user.role === "PLAYER")
    return (
      <div className="admin-login">
        <Logo />
        <Empty
          title="Tashkilotchi ruxsati talab qilinadi"
          detail="Turnir yaratish uchun tashkilotchi hisobi bilan kiring."
        />
        <Button asChild>
          <Link href="/login">Kirish</Link>
        </Button>
      </div>
    );
  const input = (
    key: keyof typeof form,
    label: string,
    type = "text",
    required = true,
  ) => (
    <label>
      {label}
      <input
        type={type}
        required={required}
        value={form[key]}
        min={type === "number" ? 0 : undefined}
        onChange={(e) =>
          change(
            key,
            type === "number" ? Number(e.target.value) : e.target.value,
          )
        }
      />
    </label>
  );
  return (
    <div className="wizard-page">
      <header>
        <Logo />
        <Link className="text-link" href="/admin">
          Ish maydoniga qaytish
        </Link>
      </header>
      <div className="wizard-layout">
        <aside>
          <span className="eyebrow">SAHNANI TAYYORLANG</span>
          <h1>
            Sizning turniringiz.
            <br />
            <span>Sizning qoidalaringiz.</span>
          </h1>
          <p>Raqobatlashishga arziydigan musobaqa yarating.</p>
          <ol className="wizard-steps">
            {steps.map((s, i) => (
              <li
                className={i === step ? "active" : i < step ? "complete" : ""}
                key={s}
              >
                <span>
                  {i < step ? (
                    <Check size={16} />
                  ) : (
                    String(i + 1).padStart(2, "0")
                  )}
                </span>
                {s}
              </li>
            ))}
          </ol>
        </aside>
        <section className="panel wizard-card">
          <span className="eyebrow">7 TA BOSQICHNING {step + 1}-BOSQICHI</span>
          <h2>{steps[step]}</h2>
          <form
            className="form"
            onSubmit={async (e) => {
              e.preventDefault();
              setError("");
              if (step < 6) {
                setStep(step + 1);
                return;
              }
              setBusy(true);
              try {
                const { first, second, third, ...rest } = form;
                const t = await mutate<Tournament>("/tournaments", {
                  ...rest,
                  registration_start: toUtc(form.registration_start),
                  registration_end: toUtc(form.registration_end),
                  start_date: toUtc(form.start_date),
                  prizes: { "1": first, "2": second, "3": third },
                });
                toast.success("Turnir chop etildi");
                router.push(`/tournaments/${t.slug}`);
              } catch (e) {
                setError((e as Error).message);
              } finally {
                setBusy(false);
              }
            }}
          >
            {step === 0 && (
              <>
                {input("name", "Turnir nomi")}
                <label>
                  OвЂyin
                  <select
                    value={form.game}
                    onChange={(e) => {
                      change("game", e.target.value);
                      if (e.target.value === "pubg") {
                        change("format", "league");
                        change("mode", "team");
                      }
                    }}
                  >
                    <option value="efootball">eFootball</option>
                    <option value="pubg">PUBG Mobile</option>
                  </select>
                </label>
                <label>
                  Tavsif
                  <textarea
                    value={form.description}
                    onChange={(e) => change("description", e.target.value)}
                    rows={4}
                  />
                </label>
                {input("banner", "Banner rasm havolasi (ixtiyoriy)", "url", false)}
                {input("logo", "Logotip havolasi (ixtiyoriy)", "url", false)}
              </>
            )}
            {step === 1 && (
              <div className="format-options">
                {(form.game === "pubg"
                  ? ["league"]
                  : [
                      "single_elimination",
                      "double_elimination",
                      "league",
                      "groups_playoffs",
                      "round_robin",
                    ]
                ).map((f) => (
                  <button
                    type="button"
                    className={form.format === f ? "selected" : ""}
                    key={f}
                    onClick={() => change("format", f)}
                  >
                    <Network />
                    <strong>{formatName(f)}</strong>
                    <span>
                      {f === "groups_playoffs"
                        ? "Aylana tizimdagi guruhlar, soвЂngra pley-off"
                        : f === "double_elimination"
                          ? "Quyi toвЂr orqali ikkinchi imkoniyat"
                          : f === "league"
                            ? "Har bir natija turnir jadvalini shakllantiradi"
                            : f === "round_robin"
                              ? "Barcha ishtirokchilar oвЂzaro bellashadi"
                              : "Chempionlik sari toвЂgвЂridan-toвЂgвЂri yoвЂl"}
                    </span>
                  </button>
                ))}
              </div>
            )}
            {step === 2 && (
              <>
                <label>
                  Ishtirok formati
                  <select
                    value={form.mode}
                    onChange={(e) => change("mode", e.target.value)}
                    disabled={form.game === "pubg"}
                  >
                    <option value="solo">Yakka oвЂyinchilar (Solo)</option>
                    <option value="team">Jamoalar (Squad)</option>
                  </select>
                </label>
                {input("max_participants", "Maksimal ishtirokchilar soni", "number")}
                {form.mode === "team" && (
                  <div className="form-grid">
                    {input("min_team_size", "Minimal tarkib soni", "number")}
                    {input("max_team_size", "Maksimal tarkib soni", "number")}
                  </div>
                )}
                <p className="hint">
                  Double elimination formati uchun 2, 4, 8, 16, 32, 64 yoki 128
                  nafar tasdiqlangan ishtirokchi talab qilinadi.
                </p>
              </>
            )}
            {step === 3 && (
              <>
                {input(
                  "registration_start",
                  "Qabul boshlanishi (Toshkent, UTC+5)",
                  "datetime-local",
                )}
                {input(
                  "registration_end",
                  "RoвЂyxatdan oвЂtish tugashi",
                  "datetime-local",
                )}
                {input("start_date", "Turnir boshlanishi (Toshkent, UTC+5)", "datetime-local")}
                <p className="hint">
                  Vaqtlar qurilmangiz vaqt mintaqasida koвЂrsatiladi va UTC formatida saqlanadi.
                </p>
              </>
            )}
            {step === 4 && (
              <>
                {input("prize_pool", "Jami mukofot jamgвЂarmasi (USD)", "number")}
                <div className="form-grid">
                  {input("first", "1-oвЂrin (USD)", "number")}
                  {input("second", "2-oвЂrin (USD)", "number")}
                  {input("third", "3-oвЂrin (USD)", "number")}
                </div>
                <p className="hint">
                  Taqsimlangan mukofotlar jami mukofot jamgвЂarmasidan oshmasligi kerak.
                </p>
              </>
            )}
            {step === 5 && (
              <label>
                Turnir qoidalari
                <textarea
                  rows={12}
                  required
                  value={form.rules}
                  onChange={(e) => change("rules", e.target.value)}
                />
              </label>
            )}
            {step === 6 && (
              <div className="publish-summary">
                <Trophy size={42} />
                <h3>{form.name}</h3>
                <p>{form.description}</p>
                {[
                  ["OвЂyin", gameName(form.game)],
                  ["Format", formatName(form.format)],
                  ["Ishtirokchilar", `${form.max_participants} ${form.mode === "team" ? "jamoa" : "oвЂyinchi"}`],
                  ["Mukofot jamgвЂarmasi", money(form.prize_pool)],
                  ["Boshlanishi", form.start_date.replace("T", " В· ")],
                ].map(([k, v]) => (
                  <div className="list-row" key={k}>
                    <span>{k}</span>
                    <strong>{v}</strong>
                  </div>
                ))}
                <p>
                  Turniringiz ommaviy koвЂrinishga oвЂtadi va belgilangan muddatda
                  roвЂyxatdan oвЂtish ochiq boвЂladi.
                </p>
              </div>
            )}
            {error && (
              <p className="form-error" role="alert">
                {error}
              </p>
            )}
            <div className="wizard-actions">
              <Button
                variant="secondary"
                type="button"
                disabled={step === 0 || busy}
                onClick={() => setStep(step - 1)}
              >
                Ortga
              </Button>
              <Button disabled={busy}>
                {busy
                  ? "Chop etilmoqdaвЂ¦"
                  : step === 6
                    ? "Turnirni chop etish"
                    : "Davom etish"}
              </Button>
            </div>
          </form>
        </section>
      </div>
    </div>
  );
}
