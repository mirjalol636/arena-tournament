"use client";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useState } from "react";
import {
  Trophy,
  Users,
  CalendarDays,
  Gamepad2,
  ShieldCheck,
  Clock3,
  Check,
  Radio,
} from "lucide-react";
import { toast } from "sonner";
import { Shell } from "@/components/shell";
import { useAuth } from "@/components/auth-provider";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/dialog";
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
  Countdown,
  statusLabels,
} from "@/components/competition";
import { useApi } from "@/hooks/use-api";
import { mutate } from "@/services/api";
import { money, date, gameName, formatName, modeLabels } from "@/lib/utils";
import type { Tournament, Team, Match, Player, Registration } from "@/types";

export function ResultDialog({
  match: m,
  close,
  onSaved,
}: {
  match: Match | null;
  close: () => void;
  onSaved: () => void;
}) {
  const { user } = useAuth(),
    [busy, setBusy] = useState(false);
  const action = async (path: string, data: unknown, method = "POST") => {
    setBusy(true);
    try {
      await mutate(path, data, method);
      toast.success("Natija saqlandi");
      onSaved();
      close();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <Modal
      open={!!m}
      onOpenChange={(v) => !v && close()}
      title={
        m
          ? `${m.home?.name || "Lobbiy"} vs ${m.away?.name || "Maydon"}`
          : "O‘yin natijasi"
      }
      description={m?.round}
    >
      {m && (
        <>
          <Badge status={m.status} />
          {m.game === "pubg" ? (
            <div className="table-scroll">
              <table>
                <thead>
                  <tr>
                    <th>Jamoa ID</th>
                    <th>O‘rin</th>
                    <th>Killlar</th>
                    <th>Jami ochko</th>
                  </tr>
                </thead>
                <tbody>
                  {m.pubg_results.map((r) => (
                    <tr key={r.participant_id}>
                      <td>{r.participant_id}</td>
                      <td>{r.placement}</td>
                      <td>{r.kills}</td>
                      <td>{r.total}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {!m.pubg_results.length && (
                <p>Lobbiy natijalari kiritilgandan so‘ng bu yerda ko‘rinadi.</p>
              )}
            </div>
          ) : (
            <>
              <div className="result-score">
                <Avatar name={m.home?.name || "Aniqlanmoqda"} />
                <b>
                  {m.home_score ?? "–"} : {m.away_score ?? "–"}
                </b>
                <Avatar name={m.away?.name || "Aniqlanmoqda"} />
              </div>
              {m.results.map((r) => (
                <div className="result-proposal" key={r.id}>
                  <span>
                    {r.home_score} : {r.away_score}{" "}
                    {r.home_penalties !== null &&
                      `(${r.home_penalties}–${r.away_penalties} pen.)`}
                  </span>
                  <Badge status={r.state} />
                  {user &&
                    r.submitted_by !== user.id &&
                    r.state === "pending" && (
                      <div className="row">
                        <Button
                          size="sm"
                          disabled={busy}
                          onClick={() =>
                            void action(
                              `/results/${r.id}`,
                              { state: "confirmed" },
                              "PATCH",
                            )
                          }
                        >
                          Tasdiqlash
                        </Button>
                        <Button
                          size="sm"
                          variant="secondary"
                          disabled={busy}
                          onClick={() =>
                            void action(
                              `/results/${r.id}`,
                              { state: "disputed" },
                              "PATCH",
                            )
                          }
                        >
                          Nizo qo‘zg‘atish
                        </Button>
                      </div>
                    )}
                </div>
              ))}
              {user &&
              ["scheduled", "live"].includes(m.status) &&
              m.home &&
              m.away ? (
                <form
                  className="form"
                  onSubmit={(e) => {
                    e.preventDefault();
                    const f = new FormData(e.currentTarget);
                    void action(`/matches/${m.id}/results`, {
                      home_score: Number(f.get("home")),
                      away_score: Number(f.get("away")),
                      home_penalties:
                        f.get("hp") === "" ? null : Number(f.get("hp")),
                      away_penalties:
                        f.get("ap") === "" ? null : Number(f.get("ap")),
                      extra_time: f.get("extra") === "on",
                    });
                  }}
                >
                  <div className="form-grid">
                    <label>
                      {m.home.name}
                      <input
                        type="number"
                        name="home"
                        min="0"
                        max="99"
                        required
                        defaultValue={m.home_score ?? 0}
                      />
                    </label>
                    <label>
                      {m.away.name}
                      <input
                        type="number"
                        name="away"
                        min="0"
                        max="99"
                        required
                        defaultValue={m.away_score ?? 0}
                      />
                    </label>
                    <label>
                      1-jamoa penaltilari
                      <input
                        type="number"
                        min="0"
                        max="99"
                        name="hp"
                        placeholder="Ixtiyoriy"
                      />
                    </label>
                    <label>
                      2-jamoa penaltilari
                      <input
                        type="number"
                        min="0"
                        max="99"
                        name="ap"
                        placeholder="Ixtiyoriy"
                      />
                    </label>
                  </div>
                  <label className="checkbox">
                    <input name="extra" type="checkbox" />
                    Qo‘shimcha vaqt o‘ynaldi
                  </label>
                  <p className="hint">
                    O‘yinchilar natijani raqib tasdiqlashi uchun yuboradilar. Hakamlar va
                    tashkilotchilar natijani to‘g‘ridan-to‘g‘ri belgilashlari mumkin.
                  </p>
                  <Button disabled={busy}>
                    {busy ? "Saqlanmoqda…" : "Natijani yuborish"}
                  </Button>
                </form>
              ) : (
                !user && (
                  <Button asChild>
                    <Link href="/login">Natija yuborish uchun tizimga kiring</Link>
                  </Button>
                )
              )}
            </>
          )}
        </>
      )}
    </Modal>
  );
}

function RegistrationDialog({
  t,
  open,
  close,
}: {
  t: Tournament;
  open: boolean;
  close: () => void;
}) {
  const { user } = useAuth(),
    [step, setStep] = useState(0),
    [busy, setBusy] = useState(false),
    [done, setDone] = useState("");
  const teams = useApi<Team[]>(open && t.mode === "team" ? "/teams" : null);
  const profile = useApi<Player>(
    open && user ? `/players/${user.nickname}` : null,
  );
  const [team, setTeam] = useState("");
  return (
    <Modal
      open={open}
      onOpenChange={(v) => !v && close()}
      title={done ? "Siz ro‘yxatga qo‘shildingiz." : "Arenaga kirish"}
      description={t.name}
    >
      {!user ? (
        <div className="form">
          <p>Ushbu turnirda qatnashish uchun ro‘yxatdan o‘ting yoki hisobingizga kiring.</p>
          <Button asChild>
            <Link href="/login">Kirish / Ro‘yxatdan o‘tish</Link>
          </Button>
        </div>
      ) : done ? (
        <div className="success-state">
          <Check />
          <h3>Ro‘yxatdan o‘tish: {statusLabels[done] || done}</h3>
          <p>
            Tashkilotchi arizangizni ko‘rib chiqadi. Holatini profilingizdan
            kuzatib borishingiz mumkin.
          </p>
          <Button onClick={close}>Tayyor</Button>
        </div>
      ) : (
        <>
          <div className="step-indicator">
            <span className={step === 0 ? "active" : ""}>
              01 · O‘yinchi ma’lumotlari
            </span>
            <span className={step === 1 ? "active" : ""}>
              02 · Ishtirokni tasdiqlash
            </span>
          </div>
          {step === 0 ? (
            <form
              key={profile.data?.id || "loading"}
              className="form"
              onSubmit={async (e) => {
                e.preventDefault();
                setBusy(true);
                const f = new FormData(e.currentTarget);
                try {
                  await mutate(
                    "/users/me/profile",
                    {
                      full_name: f.get("full_name"),
                      region: f.get("region"),
                      avatar: f.get("avatar") || "",
                      phone: f.get("phone") || "",
                      game_ids: {
                        ...profile.data?.game_ids,
                        [t.game]: f.get("game_id"),
                      },
                    },
                    "PUT",
                  );
                  setStep(1);
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
                  <input
                    name="full_name"
                    required
                    defaultValue={profile.data?.full_name}
                  />
                </label>
                <label>
                  Taxallus
                  <input disabled value={user.nickname} />
                </label>
                <label>
                  {gameName(t.game)} ID
                  <input
                    name="game_id"
                    required
                    defaultValue={profile.data?.game_ids[t.game]}
                  />
                </label>
                <label>
                  Hudud
                  <input
                    name="region"
                    required
                    defaultValue={profile.data?.region || "O‘zbekiston"}
                  />
                </label>
                <label>
                  Telefon (ixtiyoriy)
                  <input name="phone" type="tel" />
                </label>
                <label>
                  Avatar rasm havolasi (ixtiyoriy)
                  <input
                    name="avatar"
                    type="url"
                    placeholder="https://"
                    defaultValue={profile.data?.avatar}
                  />
                </label>
              </div>
              <p className="hint">
                Telegram hisobingizni tasdiqlangan Telegram orqali ulashingiz mumkin.
                Buni profilingizdan amalga oshirasiz.
              </p>
              {t.mode === "team" && (
                <label>
                  Sizning jamoangiz
                  <select
                    required
                    value={team}
                    onChange={(e) => setTeam(e.target.value)}
                  >
                    <option value="">Siz sardor bo‘lgan jamoani tanlang</option>
                    {teams.data
                      ?.filter((x) => x.captain === user.nickname)
                      .map((x) => (
                        <option value={x.id} key={x.id}>
                          {x.name} · {x.members.length} nafar o‘yinchi
                        </option>
                      ))}
                  </select>
                  <Link className="text-link" href="/profile">
                    Profilingizdan jamoa yarating
                  </Link>
                </label>
              )}
              <Button disabled={busy || profile.loading}>
                {busy ? "Saqlanmoqda…" : "Davom etish"}
              </Button>
            </form>
          ) : (
            <div className="form">
              <div className="entry-summary">
                <Avatar name={user.nickname} />
                <div>
                  <strong>{user.nickname}</strong>
                  <p>
                    {gameName(t.game)} · {formatName(t.format)}
                  </p>
                </div>
                <Badge status="pending" />
              </div>
              <div className="rules-preview">{t.rules}</div>
              <label className="checkbox">
                <input
                  type="checkbox"
                  required
                  id="rules-accept"
                  onChange={(e) => e.currentTarget.form?.checkValidity()}
                />
                Turnir qoidalariga roziman.
              </label>
              <Button
                disabled={busy}
                onClick={async () => {
                  const accepted = (
                    document.getElementById("rules-accept") as HTMLInputElement
                  ).checked;
                  if (!accepted) {
                    toast.error("Davom etish uchun turnir qoidalarini qabul qiling");
                    return;
                  }
                  setBusy(true);
                  try {
                    const r = await mutate<{ status: string }>(
                      `/tournaments/${t.slug}/register`,
                      { team_id: t.mode === "team" ? Number(team) : null },
                    );
                    setDone(r.status);
                  } catch (e) {
                    toast.error((e as Error).message);
                  } finally {
                    setBusy(false);
                  }
                }}
              >
                {busy ? "Yuborilmoqda…" : "Ro‘yxatdan o‘tishni tasdiqlash"}
              </Button>
              <Button variant="ghost" onClick={() => setStep(0)}>
                Ma’lumotlarga qaytish
              </Button>
            </div>
          )}
        </>
      )}
    </Modal>
  );
}

export function TournamentPage({ slug }: { slug: string }) {
  const search = useSearchParams(),
    [tab, setTab] = useState(search.get("tab") || "Overview"),
    [registration, setRegistration] = useState(false),
    [selected, setSelected] = useState<Match | null>(null);
  const result = useApi<Tournament>(`/tournaments/${slug}`, 15000),
    t = result.data;
  const tabList = [
    { key: "Overview", label: "Umumiy ko‘rinish" },
    { key: "Participants", label: "Ishtirokchilar" },
    { key: "Matches", label: "O‘yinlar" },
    { key: "Groups", label: "Guruhlar" },
    { key: "Bracket", label: "Turnir setkasi" },
    { key: "Leaderboard", label: "Reyting" },
    { key: "Rules", label: "Qoidalar" },
  ];
  return (
    <Shell>
      {result.loading ? (
        <Loading />
      ) : result.error ? (
        <ErrorState message={result.error} retry={result.reload} />
      ) : (
        t && (
          <div className="container page">
            <div className="breadcrumbs">
              <Link href="/tournaments">Turnirlar</Link>
              <span>/</span>
              {gameName(t.game)}
            </div>
            <section
              className={`tournament-hero ${t.game}`}
              style={
                t.banner
                  ? {
                      backgroundImage: `linear-gradient(90deg,#101019,#10101970),url(${t.banner})`,
                    }
                  : undefined
              }
            >
              <div className="tournament-hero-main">
                <div className="row">
                  <span className="game-label">
                    <Gamepad2 size={14} />
                    {gameName(t.game)}
                  </span>
                  <Badge status={t.status} />
                </div>
                <h1>{t.name}</h1>
                <p>{t.description}</p>
                <div className="row">
                  <Button
                    disabled={t.status !== "registration"}
                    onClick={() => setRegistration(true)}
                  >
                    {t.status === "registration"
                      ? "Ro‘yxatdan o‘tish"
                      : t.status === "finished"
                        ? "Turnir yakunlangan"
                        : "Ro‘yxatdan o‘tish yopilgan"}
                  </Button>
                  <span className="hero-format">
                    <ShieldCheck size={15} />
                    {formatName(t.format)}
                  </span>
                </div>
              </div>
              <div className="tournament-prize">
                <Trophy size={52} strokeWidth={1.2} />
                <small>MUKOFOT JAMG‘ARMASI</small>
                <strong>{money(t.prize_pool)}</strong>
                <span>
                  {t.mode === "team" ? "Jamoaviy" : "Yakka"} · {t.participants}/
                  {t.max_participants} ishtirokchi
                </span>
              </div>
            </section>
            <div className="tournament-facts">
              <span>
                <Users />
                {t.participants} {t.mode === "team" ? "jamoa" : "o‘yinchi"}
              </span>
              <span>
                <CalendarDays />
                Boshlanishi: {date(t.start_date)}
              </span>
              <span>
                <Clock3 />
                Ro‘yxatdan o‘tish tugashi: {date(t.registration_end)}
              </span>
              <span>
                <ShieldCheck />
                {formatName(t.format)}
              </span>
            </div>
            <nav className="tabs" aria-label="Turnir bo‘limlari">
              {tabList.map(({ key, label }) => (
                <button
                  key={key}
                  className={tab === key ? "active" : ""}
                  onClick={() => {
                    setTab(key);
                    window.history.replaceState(null, "", `?tab=${key}`);
                  }}
                >
                  {label}
                  {key === "Matches" && <span>{t.matches}</span>}
                </button>
              ))}
            </nav>
            <div className="tab-content">
              {tab === "Overview" && (
                <>
                  <div className="stat-grid">
                    <StatCard
                      label="Ishtirokchilar"
                      value={t.participants}
                      icon={Users}
                    />
                    <StatCard
                      label="Jami o‘yinlar"
                      value={t.matches}
                      icon={Gamepad2}
                    />
                    <StatCard
                      label="Yakunlangan"
                      value={t.completed}
                      icon={ShieldCheck}
                    />
                    <StatCard
                      label="Hozir jonli efirda"
                      value={t.live}
                      icon={Radio}
                    />
                  </div>
                  <div className="overview-grid">
                    <div>
                      <div className="section-heading small">
                        <h2>Navbatdagi o‘yinlar</h2>
                        <button
                          className="text-link"
                          onClick={() => setTab("Matches")}
                        >
                          Barcha o‘yinlar
                        </button>
                      </div>
                      <div className="match-grid">
                        {t.match_list
                          .filter((m) =>
                            ["scheduled", "live"].includes(m.status),
                          )
                          .slice(0, 4)
                          .map((m) => (
                            <MatchCard
                              match={m}
                              onSelect={setSelected}
                              key={m.id}
                            />
                          ))}
                      </div>
                      {!t.match_list.length && (
                        <Empty
                          title="O‘yinlar jadvali tez kunda"
                          detail="Tasdiqlangan ishtirokchilar ro‘yxatdan o‘tish tugagandan so‘ng jadvalga kiritiladi."
                        />
                      )}
                    </div>
                    <aside className="panel tournament-progress">
                      <span className="eyebrow">CHEMPIONLIK SARI YO‘L</span>
                      <h3>Turnir borishi</h3>
                      <div className="progress-number">
                        {t.matches
                          ? Math.round((t.completed / t.matches) * 100)
                          : 0}
                        <span>%</span>
                      </div>
                      <div className="progress-track">
                        <span
                          style={{
                            width: `${t.matches ? (t.completed / t.matches) * 100 : 0}%`,
                          }}
                        />
                      </div>
                      <p>
                        {t.matches} ta o‘yindan {t.completed} tasi yakunlandi
                      </p>
                      <div className="divider" />
                      {t.announcements.map((a) => (
                        <div key={a.id} className="announcement">
                          <Badge status="announcement" />
                          <h4>{a.title}</h4>
                          <p>{a.body}</p>
                        </div>
                      ))}
                      {t.status === "registration" && (
                        <>
                          <small>RO‘YXATDAN O‘TISH TUGASHIGA</small>
                          <Countdown at={t.registration_end} />
                        </>
                      )}
                    </aside>
                  </div>
                  <div className="section-heading small">
                    <h2>So‘nggi natijalar</h2>
                  </div>
                  <div className="match-grid three">
                    {t.match_list
                      .filter((m) => m.status === "completed")
                      .slice(-3)
                      .map((m) => (
                        <MatchCard
                          match={m}
                          onSelect={setSelected}
                          key={m.id}
                        />
                      ))}
                  </div>
                </>
              )}
              {tab === "Participants" && (
                <div className="participant-grid">
                  {t.participant_list.map((p) => (
                    <Link
                      href={
                        p.team_id ? `/teams/${p.team_id}` : `/players/${p.name}`
                      }
                      className="participant-card"
                      key={p.id}
                    >
                      <Avatar name={p.name} src={p.avatar} />
                      <div>
                        <strong>{p.name}</strong>
                        <small>SARALASH #{p.seed}</small>
                      </div>
                      <ShieldCheck size={17} />
                    </Link>
                  ))}
                  {!t.participant_list.length && (
                    <Empty
                      title="Ilk ishtirokchilardan biri bo‘ling"
                      detail="Tasdiqlangan ishtirokchilar shu yerda ko‘rinadi."
                    />
                  )}
                </div>
              )}
              {tab === "Matches" && (
                <div className="match-grid three">
                  {t.match_list.map((m) => (
                    <MatchCard match={m} onSelect={setSelected} key={m.id} />
                  ))}
                  {!t.match_list.length && (
                    <Empty
                      title="Hali o‘yinlar rejalashtirilmagan"
                      detail="Ro‘yxatdan o‘tish yakunlangandan so‘ng tekshiring."
                    />
                  )}
                </div>
              )}
              {tab === "Groups" && (
                <>
                  <div className="section-heading small">
                    <h2>Guruh bosqichi</h2>
                    <span className="qualification-key">
                      <i />
                      Saralash zonasi · Dastlabki 2 o‘rin
                    </span>
                  </div>
                  <div className="groups-grid">
                    {t.groups.map((g) => (
                      <section className="panel" key={g.id}>
                        <div className="panel-heading">
                          <h3>{g.name}</h3>
                          <span>{g.standings.length} nafar o‘yinchi</span>
                        </div>
                        <StandingsTable
                          rows={g.standings}
                          game={t.game}
                          qualified={t.format === "groups_playoffs" ? 2 : 0}
                        />
                      </section>
                    ))}
                  </div>
                  {!t.groups.length && (
                    <Empty
                      title="Guruh bosqichi mavjud emas"
                      detail="Ushbu turnirda guruhlar rejalashtirilmagan yoki to‘g‘ridan-to‘g‘ri pley-off tizimi qo‘llaniladi."
                    />
                  )}
                </>
              )}
              {tab === "Bracket" && (
                <div className="panel bracket-panel">
                  <div className="panel-heading">
                    <div>
                      <span className="eyebrow">
                        HAR BIR O‘YIN. G‘ALABAGA BIR QADAM.
                      </span>
                      <h2>Chempionlik turnir setkasi</h2>
                    </div>
                    <Trophy className="purple" />
                  </div>
                  <Bracket matches={t.match_list} onSelect={setSelected} />
                </div>
              )}
              {tab === "Leaderboard" && (
                <div className="panel">
                  <div className="panel-heading">
                    <h2>Turnir jadvali</h2>
                    <span>
                      {t.game === "pubg"
                        ? "O‘rin + killlar"
                        : "G‘alaba 3 · Durang 1 · Mag‘lubiyat 0"}
                    </span>
                  </div>
                  <StandingsTable rows={t.leaderboard} game={t.game} />
                </div>
              )}
              {tab === "Rules" && (
                <div className="rules-layout">
                  <section className="panel prose">
                    <span className="eyebrow">HALOL O‘YIN SHU YERDAN BOSHLANADI</span>
                    <h2>Turnir qoidalari</h2>
                    <p className="preserve">{t.rules}</p>
                  </section>
                  <aside className="panel prose">
                    <ShieldCheck />
                    <h3>Musobaqa tafsilotlari</h3>
                    <p>
                      {formatName(t.format)} · {modeLabels[t.mode] || t.mode}
                    </p>
                    <p>Maksimal {t.max_participants} nafar ishtirokchi.</p>
                    {t.mode === "team" && (
                      <p>
                        Tarkibda {t.min_team_size}–{t.max_team_size} nafar o‘yinchi (zaxira
                        o‘yinchilari bilan birga).
                      </p>
                    )}
                    {t.game === "pubg" && (
                      <>
                        <h4>O‘rinlar bo‘yicha ochkolar</h4>
                        {Object.entries(t.placement_points).map(([p, v]) => (
                          <div className="list-row" key={p}>
                            <span>{p}-o‘rin</span>
                            <strong>{v} ochko</strong>
                          </div>
                        ))}
                        <p>Har bir kill uchun {t.kill_points} ochko.</p>
                      </>
                    )}
                  </aside>
                </div>
              )}
            </div>
            <RegistrationDialog
              t={t}
              open={registration}
              close={() => setRegistration(false)}
            />
            <ResultDialog
              match={selected}
              close={() => setSelected(null)}
              onSaved={result.reload}
            />
          </div>
        )
      )}
    </Shell>
  );
}
