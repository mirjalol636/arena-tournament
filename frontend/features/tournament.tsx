"use client";
import Link from "next/link";
import { RegistrationEntry } from "./registration";
import { MediaSection } from "./media";
import { useSearchParams } from "next/navigation";
import { useState } from "react";
import {
  Trophy,
  Users,
  CalendarDays,
  Gamepad2,
  ShieldCheck,
  Clock3,

  Radio} from "lucide-react";
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
  Countdown} from "@/components/competition";
import { useApi } from "@/hooks/use-api";
import { mutate } from "@/services/api";
import { money, date, gameName, formatName, modeLabels } from "@/lib/utils";
import type { Tournament,  Match} from "@/types";

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
          : "OвЂyin natijasi"
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
                    <th>OвЂrin</th>
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
                <p>Lobbiy natijalari kiritilgandan soвЂng bu yerda koвЂrinadi.</p>
              )}
            </div>
          ) : (
            <>
              <div className="result-score">
                <Avatar name={m.home?.name || "Aniqlanmoqda"} />
                <b>
                  {m.home_score ?? "вЂ“"} : {m.away_score ?? "вЂ“"}
                </b>
                <Avatar name={m.away?.name || "Aniqlanmoqda"} />
              </div>
              {m.results.map((r) => (
                <div className="result-proposal" key={r.id}>
                  <span>
                    {r.home_score} : {r.away_score}{" "}
                    {r.home_penalties !== null &&
                      `(${r.home_penalties}вЂ“${r.away_penalties} pen.)`}
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
                          Nizo qoвЂzgвЂatish
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
                    QoвЂshimcha vaqt oвЂynaldi
                  </label>
                  <p className="hint">
                    OвЂyinchilar natijani raqib tasdiqlashi uchun yuboradilar. Hakamlar va
                    tashkilotchilar natijani toвЂgвЂridan-toвЂgвЂri belgilashlari mumkin.
                  </p>
                  <Button disabled={busy}>
                    {busy ? "SaqlanmoqdaвЂ¦" : "Natijani yuborish"}
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

export function TournamentPage({ slug }: { slug: string }) {
  const search = useSearchParams(),
    [tab, setTab] = useState(search.get("tab") || "Overview"),
    [selected, setSelected] = useState<Match | null>(null);
  const result = useApi<Tournament>(`/tournaments/${slug}`, 15000),
    t = result.data;
  const tabList = [
    { key: "Overview", label: "Umumiy koвЂrinish" },
    { key: "Participants", label: "Ishtirokchilar" },
    { key: "Matches", label: "OвЂyinlar" },
    { key: "Groups", label: "Guruhlar" },
    { key: "Bracket", label: "Turnir setkasi" },
    { key: "Leaderboard", label: "Reyting" },
    { key: "Rules", label: "Qoidalar" },
    { key: "Media", label: "Media" },
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
                  <RegistrationEntry t={t} onSaved={result.reload}/>
                  <span className="hero-format">
                    <ShieldCheck size={15} />
                    {formatName(t.format)}
                  </span>
                </div>
              </div>
              <div className="tournament-prize">
                <Trophy size={52} strokeWidth={1.2} />
                <small>MUKOFOT JAMGвЂARMASI</small>
                <strong>{money(t.prize_pool)}</strong>
                <span>
                  {t.mode === "team" ? "Jamoaviy" : "Yakka"} В· {t.participants}/
                  {t.max_participants} ishtirokchi
                </span>
              </div>
            </section>
            <div className="tournament-facts">
              <span>
                <Users />
                {t.participants} {t.mode === "team" ? "jamoa" : "oвЂyinchi"}
              </span>
              <span>
                <CalendarDays />
                Boshlanishi: {date(t.start_date)}
              </span>
              <span>
                <Clock3 />
                RoвЂyxatdan oвЂtish tugashi: {date(t.registration_end)}
              </span>
              <span>
                <ShieldCheck />
                {formatName(t.format)}
              </span>
            </div>
            <nav className="tabs" aria-label="Turnir boвЂlimlari">
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
              {tab === "Media" && <MediaSection tournamentId={t.id}/>}
              {tab === "Overview" && (
                <>
                  <div className="stat-grid">
                    <StatCard
                      label="Ishtirokchilar"
                      value={t.participants}
                      icon={Users}
                    />
                    <StatCard
                      label="Jami oвЂyinlar"
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
                        <h2>Navbatdagi oвЂyinlar</h2>
                        <button
                          className="text-link"
                          onClick={() => setTab("Matches")}
                        >
                          Barcha oвЂyinlar
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
                          title="OвЂyinlar jadvali tez kunda"
                          detail="Tasdiqlangan ishtirokchilar roвЂyxatdan oвЂtish tugagandan soвЂng jadvalga kiritiladi."
                        />
                      )}
                    </div>
                    <aside className="panel tournament-progress">
                      <span className="eyebrow">CHEMPIONLIK SARI YOвЂL</span>
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
                        {t.matches} ta oвЂyindan {t.completed} tasi yakunlandi
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
                          <small>ROвЂYXATDAN OвЂTISH TUGASHIGA</small>
                          <Countdown at={t.registration_end} />
                        </>
                      )}
                    </aside>
                  </div>
                  <div className="section-heading small">
                    <h2>SoвЂnggi natijalar</h2>
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
                      title="Ilk ishtirokchilardan biri boвЂling"
                      detail="Tasdiqlangan ishtirokchilar shu yerda koвЂrinadi."
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
                      title="Hali oвЂyinlar rejalashtirilmagan"
                      detail="RoвЂyxatdan oвЂtish yakunlangandan soвЂng tekshiring."
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
                      Saralash zonasi В· Dastlabki 2 oвЂrin
                    </span>
                  </div>
                  <div className="groups-grid">
                    {t.groups.map((g) => (
                      <section className="panel" key={g.id}>
                        <div className="panel-heading">
                          <h3>{g.name}</h3>
                          <span>{g.standings.length} nafar oвЂyinchi</span>
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
                      detail="Ushbu turnirda guruhlar rejalashtirilmagan yoki toвЂgвЂridan-toвЂgвЂri pley-off tizimi qoвЂllaniladi."
                    />
                  )}
                </>
              )}
              {tab === "Bracket" && (
                <div className="panel bracket-panel">
                  <div className="panel-heading">
                    <div>
                      <span className="eyebrow">
                        HAR BIR OвЂYIN. GвЂALABAGA BIR QADAM.
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
                        ? "OвЂrin + killlar"
                        : "GвЂalaba 3 В· Durang 1 В· MagвЂlubiyat 0"}
                    </span>
                  </div>
                  <StandingsTable rows={t.leaderboard} game={t.game} />
                </div>
              )}
              {tab === "Rules" && (
                <div className="rules-layout">
                  <section className="panel prose">
                    <span className="eyebrow">HALOL OвЂYIN SHU YERDAN BOSHLANADI</span>
                    <h2>Turnir qoidalari</h2>
                    <p className="preserve">{t.rules}</p>
                  </section>
                  <aside className="panel prose">
                    <ShieldCheck />
                    <h3>Musobaqa tafsilotlari</h3>
                    <p>
                      {formatName(t.format)} В· {modeLabels[t.mode] || t.mode}
                    </p>
                    <p>Maksimal {t.max_participants} nafar ishtirokchi.</p>
                    {t.mode === "team" && (
                      <p>
                        Tarkibda {t.min_team_size}вЂ“{t.max_team_size} nafar oвЂyinchi (zaxira
                        oвЂyinchilari bilan birga).
                      </p>
                    )}
                    {t.game === "pubg" && (
                      <>
                        <h4>OвЂrinlar boвЂyicha ochkolar</h4>
                        {Object.entries(t.placement_points).map(([p, v]) => (
                          <div className="list-row" key={p}>
                            <span>{p}-oвЂrin</span>
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
