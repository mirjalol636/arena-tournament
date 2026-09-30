"use client";
import Link from "next/link";
import { useState, useEffect } from "react";
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
  Search,
  Check,
  X,
  Menu,
  CalendarDays,
  Radio,
  ChevronRight,
  Eye,
  Filter,
} from "lucide-react";
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
  Empty,
  statusLabels,
} from "@/components/competition";
import { useApi } from "@/hooks/use-api";
import { mutate } from "@/services/api";
import type { AdminData, Tournament, Match, Player, Team, User, Registration } from "@/types";
import { formatName, date, gameName, money, time, roleLabels } from "@/lib/utils";
import { ResultDialog } from "./tournament";
import { MatchEditor } from "./match-editor";

const navigation = [
  { key: "Overview", label: "Umumiy ko‘rinish", icon: LayoutDashboard },
  { key: "Tournaments", label: "Turnirlar", icon: Trophy },
  { key: "Registrations", label: "Ro‘yxatdan o‘tganlar", icon: ClipboardList },
  { key: "Players", label: "O‘yinchilar", icon: Users },
  { key: "Teams", label: "Jamoalar", icon: Shield },
  { key: "Matches", label: "O‘yinlar", icon: Gamepad2 },
  { key: "Groups", label: "Guruhlar", icon: Network },
  { key: "Brackets", label: "Turnir setkasi", icon: GitBranch },
  { key: "Leaderboard", label: "Reyting", icon: BarChart3 },
  { key: "Announcements", label: "E’lonlar", icon: Megaphone },
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
          <Link href="/tournaments">Turnirlarni ko‘rish</Link>
        </Button>
      </div>
    );
  return <AdminContent />;
}

function AdminContent() {
  const { user } = useAuth(),
    [view, setView] = useState("Overview"),
    [mobile, setMobile] = useState(false),
    [slug, setSlug] = useState(""),
    [selected, setSelected] = useState<Match | null>(null),
    [pubg, setPubg] = useState<Match | null>(null),
    [confirm, setConfirm] = useState<{
      title: string;
      run: () => Promise<void>;
    } | null>(null),
    [inspectedReg, setInspectedReg] = useState<Registration | null>(null),
    [regSearch, setRegSearch] = useState(""),
    [regTournament, setRegTournament] = useState("all"),
    [regStatus, setRegStatus] = useState("all"),
    [regGame, setRegGame] = useState("all"),
    [busy, setBusy] = useState(false),
    [schedule, setSchedule] = useState(false);
  const result = useApi<AdminData>("/admin"),
    detail = useApi<Tournament>(slug ? `/tournaments/${slug}` : null),
    players = useApi<Player[]>(view === "Players" ? "/players" : null),
    teams = useApi<Team[]>(view === "Teams" ? "/teams" : null),
    users = useApi<User[]>(view === "Settings" ? "/admin/users" : null);
  const d = result.data,
    t = detail.data;
  const active =
    slug ||
    d?.tournaments.find((x) => x.status === "live")?.slug ||
    d?.tournaments[0]?.slug;
  useEffect(() => {
    if (!slug && active) setSlug(active);
  }, [slug, active]);
  const refresh = async () => {
    await result.reload();
    if (slug) await detail.reload();
  };
  const act = async (path: string, data: unknown, method = "POST") => {
    setBusy(true);
    try {
      await mutate(path, data, method);
      toast.success("O‘zgarishlar saqlandi");
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
            Ommaviy arenani ko‘rish
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
                  ? "Bugun arenangizda nimalar sodir bo‘layotganini ko‘ring."
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
                            nafar o‘yinchi
                          </span>
                          <span>·</span>
                          <span>
                            {d.tournaments.find((x) => x.slug === active)
                              ?.matches || 0}{" "}
                            ta o‘yin
                          </span>
                          <span>·</span>
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
                        detail="Ish maydoningiz bo‘yicha"
                        icon={Trophy}
                      />
                      <StatCard
                        label="Kutilayotgan arizalar"
                        value={
                          d.registrations.filter((r) => r.status === "pending")
                            .length
                        }
                        detail="Ko‘rib chiqishingiz kutilmoqda"
                        icon={ClipboardList}
                      />
                      <StatCard
                        label="Bugungi o‘yinlar"
                        value={
                          d.matches.filter(
                            (m) =>
                              new Date(m.scheduled_at).toDateString() ===
                              new Date().toDateString(),
                          ).length
                        }
                        detail="Navbatdagi hushtakka tayyor"
                        icon={Gamepad2}
                      />
                      <StatCard
                        label="Ro‘yxatdan o‘tgan o‘yinchilar"
                        value={d.players}
                        detail="Musobaqa ishtirokchilari"
                        icon={Users}
                      />
                    </div>
                    <div className="admin-dashboard-grid">
                      <section>
                        <div className="section-heading small">
                          <h2>Yaqinlashayotgan o‘yinlar</h2>
                          <button
                            className="text-link"
                            onClick={() => setView("Matches")}
                          >
                            Barchasini ko‘rish
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
                            <h3>So‘nggi ro‘yxatdan o‘tganlar</h3>
                            <button
                              className="text-link"
                              onClick={() => setView("Registrations")}
                            >
                              Barchasini ko‘rish
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
                                  title="Ro‘yxatdan o‘tishni tasdiqlash"
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
                            <h3>Turnir jadvalidan ko‘rinish</h3>
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
                        <span className="eyebrow">SO‘NGGI VOQEALAR</span>
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
                                  {date(a.created_at)} · {time(a.created_at)}
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
                            O‘yinchilarni tasdiqlash
                          </Button>
                          <Button
                            variant="secondary"
                            onClick={() => {
                              setSlug(active || "");
                              setSchedule(true);
                            }}
                          >
                            O‘yinlarni yaratish
                          </Button>
                        </div>
                      </section>
                    </div>
                  </>
                )}
                {view === "Tournaments" && (
                  <div className="panel">
                    <div className="table-scroll">
                      <table>
                        <thead>
                          <tr>
                            <th>Turnir</th>
                            <th>O‘yin</th>
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
                {view === "Registrations" && (
                  <div className="panel">
                    <div className="panel-heading" style={{ flexWrap: "wrap", gap: "12px", justifyContent: "space-between", alignItems: "center" }}>
                      <div>
                        <h2>Ro‘yxatdan o‘tish navbati</h2>
                        <span>Turnir ishtirokchilarini ko‘rib chiqish, tekshirish va tasdiqlash</span>
                      </div>
                      <div className="row" style={{ flexWrap: "wrap", gap: "6px" }}>
                        {[
                          { key: "all", label: "Barchasi", count: d.registrations.length },
                          { key: "pending", label: "Kutilayotganlar", count: d.registrations.filter((r) => r.status === "pending").length },
                          { key: "approved", label: "Tasdiqlanganlar", count: d.registrations.filter((r) => r.status === "approved").length },
                          { key: "waitlist", label: "Kutish ro‘yxati", count: d.registrations.filter((r) => r.status === "waitlist").length },
                          { key: "rejected", label: "Rad etilganlar", count: d.registrations.filter((r) => r.status === "rejected").length },
                        ].map(({ key, label, count }) => (
                          <button
                            key={key}
                            type="button"
                            className={`badge ${regStatus === key ? "live" : ""}`}
                            style={{ cursor: "pointer", padding: "6px 10px", fontSize: "11px", borderRadius: "6px" }}
                            onClick={() => setRegStatus(key)}
                          >
                            {label} ({count})
                          </button>
                        ))}
                      </div>
                    </div>

                    <div style={{ padding: "16px 21px", borderBottom: "1px solid var(--line)", display: "flex", flexWrap: "wrap", gap: "12px", alignItems: "center" }}>
                      <div style={{ position: "relative", flex: "1 1 240px", minWidth: "220px" }}>
                        <Search size={16} style={{ position: "absolute", left: "12px", top: "50%", transform: "translateY(-50%)", color: "var(--muted, #858ca0)" }} />
                        <input
                          type="search"
                          placeholder="Nikneym, ism, jamoa yoki o‘yin IDsi bo‘yicha qidirish…"
                          value={regSearch}
                          onChange={(e) => setRegSearch(e.target.value)}
                          style={{ width: "100%", paddingLeft: "36px", paddingRight: "12px", height: "38px", fontSize: "12px", borderRadius: "8px", background: "rgba(255,255,255,0.03)", border: "1px solid var(--line)" }}
                        />
                      </div>
                      <select
                        aria-label="Turnir bo‘yicha saralash"
                        value={regTournament}
                        onChange={(e) => setRegTournament(e.target.value)}
                        style={{ height: "38px", fontSize: "12px", padding: "0 12px", borderRadius: "8px", background: "rgba(255,255,255,0.03)", border: "1px solid var(--line)", minWidth: "180px" }}
                      >
                        <option value="all">Barcha turnirlar</option>
                        {d.tournaments.map((x) => (
                          <option key={x.id} value={String(x.id)}>
                            {x.name}
                          </option>
                        ))}
                      </select>
                      <select
                        aria-label="O‘yin bo‘yicha saralash"
                        value={regGame}
                        onChange={(e) => setRegGame(e.target.value)}
                        style={{ height: "38px", fontSize: "12px", padding: "0 12px", borderRadius: "8px", background: "rgba(255,255,255,0.03)", border: "1px solid var(--line)", minWidth: "140px" }}
                      >
                        <option value="all">Barcha o‘yinlar</option>
                        <option value="efootball">eFootball</option>
                        <option value="pubg">PUBG Mobile</option>
                      </select>
                    </div>

                    {d.registrations
                      .filter((r) => {
                        if (regTournament !== "all" && String(r.tournament_id) !== regTournament && r.tournament !== regTournament) {
                          return false;
                        }
                        if (regStatus !== "all" && r.status !== regStatus) {
                          return false;
                        }
                        if (regGame !== "all") {
                          const matchTourney = d.tournaments.find((t) => t.id === r.tournament_id || t.name === r.tournament);
                          const g = r.game || matchTourney?.game;
                          if (g !== regGame) return false;
                        }
                        if (regSearch.trim()) {
                          const q = regSearch.toLowerCase().trim();
                          const matchName = r.name?.toLowerCase().includes(q);
                          const matchTourn = r.tournament?.toLowerCase().includes(q);
                          const matchNick = r.nickname?.toLowerCase().includes(q);
                          const matchFull = r.full_name?.toLowerCase().includes(q);
                          const matchGameId = r.game_id?.toLowerCase().includes(q);
                          const matchTg = r.telegram_username?.toLowerCase().includes(q);
                          const matchPhone = r.phone?.toLowerCase().includes(q);
                          const matchTeam = r.team?.name?.toLowerCase().includes(q) || r.team?.members?.some((m) => m.name.toLowerCase().includes(q));
                          if (!matchName && !matchTourn && !matchNick && !matchFull && !matchGameId && !matchTg && !matchPhone && !matchTeam) {
                            return false;
                          }
                        }
                        return true;
                      })
                      .map((r) => {
                        const matchTourney = d.tournaments.find((t) => t.id === r.tournament_id || t.name === r.tournament);
                        const gameType = r.game || matchTourney?.game;
                        return (
                          <div className="registration-row" key={r.id} style={{ alignItems: "center", gap: "16px" }}>
                            <Avatar name={r.name} size="medium" />
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
                                <strong style={{ fontSize: "13px" }}>{r.name}</strong>
                                {gameType && (
                                  <span style={{ fontSize: "10px", padding: "2px 6px", borderRadius: "4px", background: "rgba(178, 152, 255, 0.12)", color: "#c2a5ff" }}>
                                    {gameName(gameType)}
                                  </span>
                                )}
                                {r.team && (
                                  <span style={{ fontSize: "10px", padding: "2px 6px", borderRadius: "4px", background: "rgba(117, 229, 170, 0.12)", color: "#75e5aa" }}>
                                    Jamoa ({r.team.members?.length || 0} a’zo)
                                  </span>
                                )}
                              </div>
                              <small style={{ marginTop: "3px", color: "var(--muted, #858ca0)" }}>
                                {r.tournament} · {date(r.created_at)}
                                {r.game_id ? ` · ID: ${r.game_id}` : ""}
                                {r.region ? ` · ${r.region}` : ""}
                                {r.telegram_username ? ` · @${r.telegram_username.replace(/^@/, "")}` : ""}
                              </small>
                            </div>
                            <Badge status={r.status} />
                            <div className="row" style={{ gap: "6px", flexShrink: 0 }}>
                              <Button
                                size="sm"
                                variant="ghost"
                                title="Batafsil ma’lumotlarni ko‘rish"
                                onClick={() => setInspectedReg(r)}
                              >
                                <Eye size={14} />
                                Batafsil
                              </Button>
                              {r.status !== "approved" && (
                                <Button
                                  size="sm"
                                  variant="default"
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
                                  Tasdiqlash
                                </Button>
                              )}
                              {r.status !== "waitlist" && (
                                <Button
                                  size="sm"
                                  variant="secondary"
                                  onClick={() =>
                                    setConfirm({
                                      title: "Ushbu ishtirokchini kutish ro‘yxatiga o‘tkazishni xohlaysizmi?",
                                      run: () =>
                                        act(
                                          `/registrations/${r.id}`,
                                          { status: "waitlist" },
                                          "PATCH",
                                        ),
                                    })
                                  }
                                >
                                  Kutish ro‘yxati
                                </Button>
                              )}
                              {r.status !== "rejected" && (
                                <Button
                                  size="sm"
                                  variant="danger"
                                  onClick={() =>
                                    setConfirm({
                                      title: "Ushbu arizani rad etishni xohlaysizmi?",
                                      run: () =>
                                        act(
                                          `/registrations/${r.id}`,
                                          { status: "rejected" },
                                          "PATCH",
                                        ),
                                    })
                                  }
                                >
                                  Rad etish
                                </Button>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    {!d.registrations.length ? (
                      <Empty
                        title="Kutilayotgan arizalar yo‘q"
                        detail="Yangi ro‘yxatdan o‘tganlar shu yerda paydo bo‘ladi."
                      />
                    ) : (
                      d.registrations.filter((r) => {
                        if (regTournament !== "all" && String(r.tournament_id) !== regTournament && r.tournament !== regTournament) return false;
                        if (regStatus !== "all" && r.status !== regStatus) return false;
                        if (regGame !== "all") {
                          const matchTourney = d.tournaments.find((t) => t.id === r.tournament_id || t.name === r.tournament);
                          if ((r.game || matchTourney?.game) !== regGame) return false;
                        }
                        if (regSearch.trim()) {
                          const q = regSearch.toLowerCase().trim();
                          if (!r.name?.toLowerCase().includes(q) && !r.tournament?.toLowerCase().includes(q) && !r.nickname?.toLowerCase().includes(q) && !r.full_name?.toLowerCase().includes(q) && !r.game_id?.toLowerCase().includes(q) && !r.telegram_username?.toLowerCase().includes(q) && !r.phone?.toLowerCase().includes(q) && !r.team?.name?.toLowerCase().includes(q)) return false;
                        }
                        return true;
                      }).length === 0 && (
                        <Empty
                          title="Hech qanday ariza topilmadi"
                          detail="Qidiruv parametrlari yoki filtrlarni o‘zgartirib ko‘ring."
                        />
                      )
                    )}
                  </div>
                )}
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
                        O‘yinlarni yaratish
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
                                Natijani kiritish / ko‘rish
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
                                      ? "Jonlini to‘xtatish"
                                      : "Jonli qilish"}
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    onClick={() =>
                                      setConfirm({
                                        title: "Ushbu o‘yin bekor qilinsinmi?",
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
                            {p.region} · {p.wins} ta g‘alaba
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
                            {x.members.length} a’zo · {x.captain}
                          </small>
                        </div>
                      </Link>
                    ))}
                  </div>
                )}
                {view === "Announcements" && (
                  <section className="panel prose narrow">
                    <h2>Turnir bo‘yicha e’lon chop etish</h2>
                    <p>
                      Chop etilgan e’lonlar turnir sahifasida va ro‘yxatdan o‘tgan
                      o‘yinchilarning xabarlar qutisida ko‘rinadi. Ulangan Telegram
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
                        E’lon matni
                        <textarea
                          name="body"
                          rows={6}
                          minLength={3}
                          maxLength={4000}
                          required
                        />
                      </label>
                      <Button disabled={busy}>E’lonni chop etish</Button>
                    </form>
                  </section>
                )}
                {view === "Telegram" && (
                  <section className="panel prose narrow">
                    <Send className="purple" size={36} />
                    <h2>Musobaqa, o‘zaro bog‘langan.</h2>
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
                      Bot turnirlarni topish, ro‘yxatdan o‘tish, turnir jadvali,
                      yaqinlashayotgan o‘yinlar va profillarni ko‘rishni qo‘llab-quvvatlaydi.
                      Tashkilotchilar arizalarni tasdiqlashlari, natijalarni kiritishlari
                      va e’lonlarni chop etishlari mumkin.
                    </p>
                    <div className="command-list">
                      /tournaments · /register · /matches · /standings ·
                      /profile · /pending · /approve · /result · /broadcast
                    </div>
                    {!d.telegram_configured && (
                      <p>
                        Server muhitida TELEGRAM_BOT_TOKEN va BOT_API_SECRET
                        o‘zgaruvchilarini sozlang, so‘ng bot servisini ishga tushiring.
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
                        Faqat bosh administratorlar rollarni o‘zgartirishi mumkin.
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
                      <p>Birinchi o‘yin jonli efirga chiqqanda ochkolar tizimi qulflanadi.</p>
                      <form
                        className="form"
                        onSubmit={(e) => {
                          e.preventDefault();
                          const f = new FormData(e.currentTarget);
                          let points;
                          try {
                            points = JSON.parse(String(f.get("placement")));
                          } catch {
                            toast.error("To‘g‘ri JSON o‘rinlar xaritasini kiriting");
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
                          O‘rinlar bo‘yicha ochkolar
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
        title="Ro‘yxatdan o‘tish ma’lumotlari"
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
                <span>O‘yin turi</span>
                <strong>{gameName(inspectedReg.game)}</strong>
              </div>
            )}
            <div className="list-row">
              <span>Ishtirokchi nomi</span>
              <strong>{inspectedReg.name}</strong>
            </div>
            {inspectedReg.full_name && (
              <div className="list-row">
                <span>To‘liq ism-familiyasi</span>
                <strong>{inspectedReg.full_name}</strong>
              </div>
            )}
            {inspectedReg.nickname && (
              <div className="list-row">
                <span>O‘yindagi taxallusi (Nick)</span>
                <strong>{inspectedReg.nickname}</strong>
              </div>
            )}
            {inspectedReg.game_id && (
              <div className="list-row">
                <span>O‘yindagi ID raqami</span>
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
                <span className="eyebrow" style={{ display: "block", marginBottom: "8px" }}>JAMOA MA’LUMOTLARI</span>
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
                    <span style={{ fontSize: "11px", color: "var(--muted, #858ca0)", display: "block", marginBottom: "6px" }}>Tarkib ro‘yxati:</span>
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
                      title: "Ushbu ishtirokchini kutish ro‘yxatiga o‘tkazishni xohlaysizmi?",
                      run: async () => {
                        await act(`/registrations/${target.id}`, { status: "waitlist" }, "PATCH");
                        setInspectedReg(null);
                      },
                    });
                  }}
                >
                  Kutish ro‘yxati
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
        description="Bu o‘zgarish turnirda va uning audit tarixida saqlanadi."
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
            {busy ? "Saqlanmoqda…" : "O‘zgarishni tasdiqlash"}
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
                "Guruhlar ishtirokchi IDlaridan iborat JSON massivlari bo‘lishi kerak",
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
            Saralash o‘rinlarini tasodifiy taqsimlash
          </label>
          <label>
            Qo‘lda saralash o‘rinlari (ixtiyoriy)
            <input name="seeds" placeholder="Ishtirokchi IDlari: 1, 4, 2, 3" />
          </label>
          <label>
            Qo‘lda guruhlar (ixtiyoriy)
            <input name="groups" placeholder="[[1,2,3,4],[5,6,7,8]]" />
          </label>
          {t && (
            <p className="hint">
              {t.participant_list.map((p) => `${p.id}: ${p.name}`).join(" · ")}
            </p>
          )}
          <label className="checkbox">
            <input type="checkbox" name="playoffs" />
            Yakunlangan guruhlardan pley-offni yaratish (har bir guruhdan 2 tadan)
          </label>
          <p className="hint">
            Mavjud o‘yinlar saqlanadi. Double elimination uchun ishtirokchilar
            soni 2 ning darajasi bo‘lishi kerak.
          </p>
          <Button disabled={busy}>
            {busy ? "Yaratilmoqda…" : "O‘yinlarni yaratish"}
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
            O‘rin
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
            ? "Saqlanmoqda…"
            : "Lobbiy natijalarini tasdiqlash"}
      </Button>
    </form>
  );
}

const steps = [
  "Asosiy ma’lumotlar",
  "Format",
  "Ishtirokchilar",
  "O‘yinlar jadvali",
  "Mukofot jamg‘armasi",
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
      "10 daqiqalik o‘yinlar. Raqibingizni hurmat qiling. O‘yindan 15 daqiqa oldin tayyor bo‘ling. O‘yinchilar hisoblarni raqib tasdiqlashi uchun yuboradilar. Nizolarni hakamlar hal qiladi.",
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
                  registration_start: new Date(
                    form.registration_start,
                  ).toISOString(),
                  registration_end: new Date(
                    form.registration_end,
                  ).toISOString(),
                  start_date: new Date(form.start_date).toISOString(),
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
                  O‘yin
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
                        ? "Aylana tizimdagi guruhlar, so‘ngra pley-off"
                        : f === "double_elimination"
                          ? "Quyi to‘r orqali ikkinchi imkoniyat"
                          : f === "league"
                            ? "Har bir natija turnir jadvalini shakllantiradi"
                            : f === "round_robin"
                              ? "Barcha ishtirokchilar o‘zaro bellashadi"
                              : "Chempionlik sari to‘g‘ridan-to‘g‘ri yo‘l"}
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
                    <option value="solo">Yakka o‘yinchilar (Solo)</option>
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
                  "Ro‘yxatdan o‘tish boshlanishi",
                  "datetime-local",
                )}
                {input(
                  "registration_end",
                  "Ro‘yxatdan o‘tish tugashi",
                  "datetime-local",
                )}
                {input("start_date", "Turnir boshlanishi", "datetime-local")}
                <p className="hint">
                  Vaqtlar qurilmangiz vaqt mintaqasida ko‘rsatiladi va UTC formatida saqlanadi.
                </p>
              </>
            )}
            {step === 4 && (
              <>
                {input("prize_pool", "Jami mukofot jamg‘armasi (USD)", "number")}
                <div className="form-grid">
                  {input("first", "1-o‘rin (USD)", "number")}
                  {input("second", "2-o‘rin (USD)", "number")}
                  {input("third", "3-o‘rin (USD)", "number")}
                </div>
                <p className="hint">
                  Taqsimlangan mukofotlar jami mukofot jamg‘armasidan oshmasligi kerak.
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
                  ["O‘yin", gameName(form.game)],
                  ["Format", formatName(form.format)],
                  ["Ishtirokchilar", `${form.max_participants} ${form.mode === "team" ? "jamoa" : "o‘yinchi"}`],
                  ["Mukofot jamg‘armasi", money(form.prize_pool)],
                  ["Boshlanishi", form.start_date.replace("T", " · ")],
                ].map(([k, v]) => (
                  <div className="list-row" key={k}>
                    <span>{k}</span>
                    <strong>{v}</strong>
                  </div>
                ))}
                <p>
                  Turniringiz ommaviy ko‘rinishga o‘tadi va belgilangan muddatda
                  ro‘yxatdan o‘tish ochiq bo‘ladi.
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
                  ? "Chop etilmoqda…"
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
