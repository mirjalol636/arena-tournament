"use client";
import Link from "next/link";
import Image from "next/image";
import { BracketConnections } from "./bracket-connections";
import { useEffect, useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import {
  Trophy,
  Users,
  CalendarDays,
  Gamepad2,


  Target,
  Clock3,
  ChevronRight,
  SearchX} from "lucide-react";
import { Button } from "./ui/button";
import { date, time, money, gameName, formatName, modeLabels } from "@/lib/utils";
import type { Tournament, Match, Standing } from "@/types";

export const statusLabels: Record<string, string> = {
  live: "Jonli",
  registration: "RoвЂyxatdan oвЂtish",
  upcoming: "Yaqinlashayotgan",
  scheduled: "Rejalashtirilgan",
  completed: "Yakunlangan",
  finished: "Yakunlangan",
  cancelled: "Bekor qilingan",
  pending: "Kutilmoqda",
  approved: "Tasdiqlangan",
  rejected: "Rad etilgan",
  waitlist: "Kutish roвЂyxatida",
  draft: "Qoralama",
  disputed: "Nizoli",
  confirmed: "Tasdiqlangan",
  announcement: "EвЂ™lon",
  connected: "Ulangan",
  "not configured": "Sozlanmagan",
  linked: "Ulangan",
  "not linked": "Ulanmagan",
};

export function Badge({ status }: { status: string }) {
  return (
    <span className={`badge ${status}`}>
      {status === "live" && <span className="live-dot" />}
      {statusLabels[status] || status.replaceAll("_", " ")}
    </span>
  );
}

export function Avatar({
  name,
  src,
  size = "normal",
}: {
  name: string;
  src?: string;
  size?: string;
}) {
  return (
    <span className={`avatar ${size} tone-${name.length % 5}`}>
      {src ? (
        <Image unoptimized width={80} height={80}
          src={src}
          alt=""
          onError={(e) => {
            e.currentTarget.style.display = "none";
          }}
        />
      ) : (
        name.slice(0, 2).toUpperCase()
      )}
    </span>
  );
}

export function StatCard({
  label,
  value,
  icon: Icon = Trophy,
  detail,
}: {
  label: string;
  value: number | string;
  icon?: typeof Trophy;
  detail?: string;
}) {
  const [shown, setShown] = useState<number | string>(
    typeof value === "number" ? 0 : value,
  );
  const reduced = useReducedMotion();
  useEffect(() => {
    if (typeof value !== "number" || reduced) {
      return;
    }
    const start = performance.now();
    let frame = 0;
    const tick = (now: number) => {
      const progress = Math.min((now - start) / 650, 1);
      setShown(Math.round(value * (1 - Math.pow(1 - progress, 3))));
      if (progress < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [value, reduced]);
  return (
    <div className="stat-card">
      <div className="stat-top">
        <span>{label}</span>
        <Icon size={18} />
      </div>
      <strong>{typeof value!=="number"||reduced?value:shown}</strong>
      {detail && <small>{detail}</small>}
    </div>
  );
}

export function TournamentCard({ t }: { t: Tournament }) {
  return (
    <motion.article
      className="tournament-card"
      whileHover={{ y: -5 }}
      transition={{ duration: 0.2 }}
    >
      <Link
        href={`/tournaments/${t.slug}`}
        className={`tournament-art ${t.game}`}
        style={
          t.banner
            ? {
                backgroundImage: `linear-gradient(0deg,#101019a0,#10101940),url(${t.banner})`,
              }
            : undefined
        }
      >
        <div className="art-top">
          <span className="game-label">
            <Gamepad2 size={14} />
            {gameName(t.game)}
          </span>
          <Badge status={t.status} />
        </div>
        <div className="art-title">
          {t.game === "pubg" ? (
            <>
              MAYDONGA TUSH.
              <br />
              <span>AJRALIB TUR.</span>
            </>
          ) : (
            <>
              SENING OвЂYINING.
              <br />
              <span>SENING GвЂALABANG.</span>
            </>
          )}
        </div>
        <div className="art-mark">
          {t.game === "pubg" ? <Target /> : <Trophy />}
        </div>
        <div className="art-bottom">
          <span>ARENA ORIGINALS</span>
          <span>MAVSUM / 26</span>
        </div>
      </Link>
      <div className="tournament-content">
        <span className="eyebrow">
          {formatName(t.format)} В· {modeLabels[t.mode] || t.mode}
        </span>
        <Link href={`/tournaments/${t.slug}`}>
          <h3>{t.name}</h3>
        </Link>
        <div className="tournament-meta">
          <span>
            <Users size={15} />
            {t.participants}/{t.max_participants}{" "}
            {t.mode === "team" ? "jamoa" : "oвЂyinchi"}
          </span>
          <span>
            <CalendarDays size={15} />
            {date(t.start_date)}
          </span>
        </div>
        <div className="card-bottom">
          <div>
            <small>MUKOFOT JAMGвЂARMASI</small>
            <strong>{money(t.prize_pool)}</strong>
          </div>
          <Link className="text-link" href={`/tournaments/${t.slug}`}>
            {t.status === "registration"
              ? "Turnirga qoвЂshilish"
              : "Turnirni koвЂrish"}
            <ChevronRight size={16} />
          </Link>
        </div>
      </div>
    </motion.article>
  );
}

export function MatchCard({
  match: m,
  onSelect,
  compact = false,
}: {
  match: Match;
  onSelect?: (m: Match) => void;
  compact?: boolean;
}) {
  const inner = (
    <>
      <div className="match-meta">
        <span>{m.round}</span>
        <Badge status={m.status} />
      </div>
      {m.game === "pubg" ? (
        <div className="pubg-match">
          <Target />
          <strong>{m.tournament}</strong>
          <span>Skvad lobbisi</span>
        </div>
      ) : (
        <div className="versus">
          <div>
            <Avatar name={m.home?.name || "Aniqlanmoqda"} src={m.home?.avatar} />
            <strong>{m.home?.name || "Aniqlanmoqda"}</strong>
          </div>
          <span className={`score ${m.status === "live" ? "is-live" : ""}`}>
            {m.home_score !== null ? (
              <>
                {m.home_score}
                <i>:</i>
                {m.away_score}
              </>
            ) : (
              <em>VS</em>
            )}
          </span>
          <div>
            <Avatar name={m.away?.name || "Aniqlanmoqda"} src={m.away?.avatar} />
            <strong>{m.away?.name || "Aniqlanmoqda"}</strong>
          </div>
        </div>
      )}
      <div className="match-footer">
        <span>
          <Clock3 size={13} />
          {date(m.scheduled_at)} В· {time(m.scheduled_at)}
        </span>
        {!compact && <span>{gameName(m.game)}</span>}
      </div>
    </>
  );
  return onSelect ? (
    <button
      onClick={() => onSelect(m)}
      className={`match-card clickable ${compact ? "compact" : ""}`}
    >
      {inner}
    </button>
  ) : (
    <Link
      href={`/tournaments/${m.slug}?tab=Matches`}
      className={`match-card ${compact ? "compact" : ""}`}
    >
      {inner}
    </Link>
  );
}

export function StandingsTable({
  rows,
  game = "efootball",
  qualified = 0,
}: {
  rows: Standing[];
  game?: string;
  qualified?: number;
}) {
  const [sort, setSort] = useState("points");
  const qualifiedIds = new Set(
    rows.slice(0, qualified).map((r) => r.participant_id),
  );
  const sorted = [...rows].sort(
    (a, b) =>
      Number(b[sort as keyof Standing]) - Number(a[sort as keyof Standing]),
  );
  return (
    <div className="table-scroll">
      <table>
        <thead>
          <tr>
            <th>#</th>
            <th>{game === "pubg" ? "Jamoa" : "OвЂyinchi"}</th>
            {(game === "pubg"
              ? ["played", "placement_points", "kill_points", "points"]
              : [
                  "played",
                  "wins",
                  "draws",
                  "losses",
                  "gf",
                  "ga",
                  "gd",
                  "points",
                ]
            ).map((c) => (
              <th key={c}>
                <button
                  onClick={() => setSort(c)}
                  title={`Saralash: ${c}`}
                  aria-label={`Saralash: ${c}`}
                >
                  {
                    (
                      {
                        played: "OвЂ",
                        wins: "GвЂ",
                        draws: "D",
                        losses: "M",
                        gf: "UR",
                        ga: "OвЂT",
                        gd: "TF",
                        points: "OCH",
                        placement_points: "OвЂRIN",
                        kill_points: "KILL",
                      } as Record<string, string>
                    )[c]
                  }
                  {sort === c ? " в†“" : ""}
                </button>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {sorted.map((r, i) => (
            <tr
              key={r.participant_id}
              className={qualifiedIds.has(r.participant_id) ? "qualified" : ""}
            >
              <td>
                <span className="rank-number">
                  {String(i + 1).padStart(2, "0")}
                </span>
              </td>
              <td>
                <Link
                  className="table-player"
                  href={
                    r.team_id ? `/teams/${r.team_id}` : `/players/${r.name}`
                  }
                >
                  <Avatar name={r.name} size="small" />
                  {r.name}
                  {qualifiedIds.has(r.participant_id) && (
                    <span
                      className="qualified-mark"
                      title="Saralash zonasi"
                    />
                  )}
                </Link>
              </td>
              {(game === "pubg"
                ? ["played", "placement_points", "kill_points", "points"]
                : [
                    "played",
                    "wins",
                    "draws",
                    "losses",
                    "gf",
                    "ga",
                    "gd",
                    "points",
                  ]
              ).map((c) => (
                <td key={c} className={c === "points" ? "points" : ""}>
                  {r[c as keyof Standing]}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      {!rows.length && (
        <Empty
          title="Turnir jadvali kutilmoqda"
          detail="Ishtirokchilar tasdiqlangandan soвЂng turnir jadvali paydo boвЂladi."
        />
      )}
    </div>
  );
}

export function Bracket({
  matches,
  onSelect,
}: {
  matches: Match[];
  onSelect?: (m: Match) => void;
}) {
  const stages = [
    ...new Set(matches.filter((m) => m.bracket_round_id).map((m) => m.stage)),
  ];
  if (!stages.length)
    return (
      <Empty
        title="Final sari yoвЂl shakllanmoqda"
        detail="Tashkilotchi pley-off bosqichini yaratganda turnir setkasi paydo boвЂladi."
        icon={Trophy}
      />
    );
  return (
    <div className="bracket-wrap">
      {stages.map((stage) => {
        const ms = matches.filter((m) => m.stage === stage);
        const rounds = [...new Set(ms.map((m) => m.bracket_round_id))];
        return (
          <section key={stage} className="bracket-stage">
            {stages.length > 1 && <h3>{formatName(stage)} turnir setkasi</h3>}
            <BracketConnections
              signature={ms
                .map((m) => `${m.id}:${m.home?.id}:${m.away?.id}:${m.status}`)
                .join(",")}
            >
              <div className="bracket">
                {rounds.map((round, i) => (
                  <div className="bracket-column" key={round}>
                    <div className="bracket-heading">
                      <span>0{i + 1}</span>
                      {ms.find((m) => m.bracket_round_id === round)?.round}
                    </div>
                    <div className="bracket-matches">
                      {ms
                        .filter((m) => m.bracket_round_id === round)
                        .map((m) => (
                          <motion.button
                            data-bracket-id={m.id}
                            data-next-id={m.next_match_id}
                            layout
                            transition={{ duration: 0.25 }}
                            onClick={() => onSelect?.(m)}
                            className={`bracket-match ${i < rounds.length - 1 ? "connected" : ""}`}
                            key={m.id}
                          >
                            <div className="bracket-match-top">
                              <span>OвЂYIN {String(m.id).padStart(2, "0")}</span>
                              <Badge status={m.status} />
                            </div>
                            {[m.home, m.away].map((p, j) => (
                              <div
                                className={`bracket-player ${p && m.winner_id === p.id ? "winner" : ""}`}
                                key={j}
                              >
                                <Avatar name={p?.name || "вЂ”"} size="small" />
                                <span>{p?.name || "Aniqlanmoqda"}</span>
                                <strong>
                                  {(j === 0 ? m.home_score : m.away_score) ??
                                    "вЂ“"}
                                </strong>
                              </div>
                            ))}
                            <small>
                              {time(m.scheduled_at)} В· {date(m.scheduled_at)}
                            </small>
                          </motion.button>
                        ))}
                    </div>
                  </div>
                ))}
                <div className="champion-column">
                  <div className="champion-icon">
                    <Trophy size={38} />
                  </div>
                  <span>YAGONA CHEMPION.</span>
                  <strong>
                    {ms.find((m) => !m.next_match_id && m.winner_id)?.[
                      ms.find((m) => !m.next_match_id && m.winner_id)
                        ?.winner_id ===
                      ms.find((m) => !m.next_match_id && m.winner_id)?.home?.id
                        ? "home"
                        : "away"
                    ]?.name || "Chempion kim boвЂladi?"}
                  </strong>
                </div>
              </div>
            </BracketConnections>
          </section>
        );
      })}
    </div>
  );
}

export function Empty({
  title,
  detail,
  icon: Icon = SearchX,
}: {
  title: string;
  detail: string;
  icon?: typeof Trophy;
}) {
  return (
    <div className="empty">
      <Icon size={30} />
      <h3>{title}</h3>
      <p>{detail}</p>
    </div>
  );
}

export function Loading() {
  return (
    <div className="container loading-grid" aria-label="Yuklanmoqda" role="status">
      {[1, 2, 3].map((x) => (
        <div className="skeleton" key={x} />
      ))}
      <span className="sr-only">Turnir maвЂ™lumotlari yuklanmoqda</span>
    </div>
  );
}

export function ErrorState({
  message,
  retry,
}: {
  message: string;
  retry: () => void;
}) {
  return (
    <div className="container">
      <Empty title="Sahifani yuklab boвЂlmadi" detail={message} />
      <div className="center">
        <Button onClick={retry}>Qaytadan urinish</Button>
      </div>
    </div>
  );
}

export function Countdown({ at }: { at: string }) {
  const [remaining, setRemaining] = useState("");
  useEffect(() => {
    const tick = () => {
      const seconds = Math.max(
        0,
        Math.floor((new Date(at).getTime() - Date.now()) / 1000),
      );
      setRemaining(
        `${Math.floor(seconds / 3600)}s ${Math.floor((seconds % 3600) / 60)}d ${seconds % 60}s`,
      );
    };
    tick();
    const t = setInterval(tick, 1000);
    return () => clearInterval(t);
  }, [at]);
  return (
    <span className="countdown">
      <Clock3 size={14} />
      {remaining || "вЂ”"}
    </span>
  );
}
