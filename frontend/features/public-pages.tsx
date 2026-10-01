"use client";
import Link from "next/link";
import { MediaSection } from "./media";
import { HomeActivity } from "./home-activity";
import { useState } from "react";
import { motion } from "framer-motion";
import {
  Trophy,
  Users,
  Gamepad2,
  Radio,
  Network,
  BarChart3,
  Bell,
  Smartphone,
  ShieldCheck,
  Search,
  SlidersHorizontal,
  Medal,
  Target,
} from "lucide-react";
import { Shell } from "@/components/shell";
import { Button } from "@/components/ui/button";
import {
  TournamentCard,
  MatchCard,
  StatCard,
  Avatar,
  Badge,
  Loading,
  ErrorState,
  Empty,
} from "@/components/competition";
import { useApi } from "@/hooks/use-api";
import type { Tournament, Match, Player } from "@/types";
import { money } from "@/lib/utils";

export function Landing() {
  const tournaments = useApi<{ items: Tournament[]; total: number }>(
      "/tournaments",
    ),
    stats = useApi<{
      tournaments: number;
      players: number;
      matches: number;
      champions: number;
      teams: number;
    }>("/stats"),
    matches = useApi<Match[]>("/matches?status=live");
  return (
    <Shell>
      <div className="container">
        <section className="hero">
          <motion.div
            className="hero-copy"
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.45 }}
          >
            <div className="season-tag">
              <span className="live-dot" />
              O‘ZBEKISTON ESPORT MAYDONI<span>{new Date().getFullYear()}</span>
            </div>
            <h1>
              BELLASHING.
              <br />
              HUKMRONLIK QILING.
              <br />
              <span>TARIX YARATING.</span>
            </h1>
            <p>
              Katta lahzalar shu yerdan boshlanadi. Turniringizni toping,
              <br className="desktop-break" /> raqiblarga qarshi turing va o‘z
              arenangizga egalik qiling.
            </p>
            <div className="hero-actions">
              <Button asChild>
                <Link href="/tournaments">
                  <Trophy size={18} />
                  Turnirlarni kashf qilish
                </Link>
              </Button>
              <Button variant="secondary" asChild>
                <Link href="/admin/new">Turnir yaratish</Link>
              </Button>
            </div>
            <div className="hero-trust">
              <Users size={22} className="purple"/>
              <span>
                <strong>{stats.data?.players ?? "—"} nafar ishtirokchi.</strong> Navbatdagi
                raqibingiz shu yerda.
              </span>
            </div>
          </motion.div>
          <motion.div
            className="hero-visual"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.65, delay: 0.1 }}
          >
            <div className="visual-grid" />
            <div className="visual-top">
              <span>G‘ALABA SARI YO‘L</span>
              <span>01 — 26</span>
            </div>
            <div className="hero-trophy">
              <Trophy strokeWidth={1} />
              <span className="trophy-orbit" />
            </div>
            <div className="hero-live-card">
              <div className="live-card-title">
                <span>
                  <Radio size={14} />
                  {matches.data?.length ? "HOZIR MAYDONDA" : "ARENA O‘YINLAR MARKAZI"}
                </span>
                {matches.data?.length ? <Badge status="live" /> : <span className="muted">Jadvalni kuzating</span>}
              </div>
              {matches.data?.[0] ? (
                <>
                  <div className="hero-match-teams">
                    <div>
                      <Avatar name={matches.data[0].home?.name || "Aniqlanmoqda"} />
                      <strong>{matches.data[0].home?.name || "Aniqlanmoqda"}</strong>
                    </div>
                    <b>
                      {matches.data[0].home_score}
                      <i>:</i>
                      {matches.data[0].away_score}
                    </b>
                    <div>
                      <Avatar name={matches.data[0].away?.name || "Aniqlanmoqda"} />
                      <strong>{matches.data[0].away?.name || "Aniqlanmoqda"}</strong>
                    </div>
                  </div>
                  <div className="hero-match-bottom">
                    <span>{matches.data[0].round} · eFootball</span>
                    <Link href="/live">
                      O‘yinlar markazi <Radio size={13} />
                    </Link>
                  </div>
                </>
              ) : (
                <div className="hero-match-teams">
                  <Trophy />
                  <strong>Navbatdagi buyuk lahzangiz</strong>
                  <Link href="/tournaments">Turnirlarni ko‘rish</Link>
                </div>
              )}
            </div>
            <div className="floating-prize">
              <span className="prize-icon">
                <Trophy size={20} />
              </span>
              <div>
                <small>{tournaments.data?.items[0]?.name || "TURNIRLARNI KASHF ETING"}</small>
                <strong>
                  {tournaments.data?.items[0] ? money(tournaments.data.items[0].prize_pool) : "ARENA"}
                </strong>
              </div>
            </div>
            <div className="visual-bottom">
              <span>MAQSAD SARI O‘YNA.</span>
              <span>G‘URUR BILAN G‘ALABA QOZON.</span>
            </div>
          </motion.div>
        </section>
        <div className="game-strip">
          <span>SENING O‘YINING. SENING SAHNANG.</span>
          <strong>
            <Gamepad2 />
            eFootball<span>™</span>
          </strong>
          <i />
          <strong className="pubg-wordmark">
            PUBG <span>MOBILE</span>
          </strong>
          <div className="strip-end">
            <ShieldCheck size={16} />
            Halol o‘yin. Haqiqiy raqobat.
          </div>
        </div>
        <section className="landing-stats">
          {[
            {
              label: "Faol turnirlar",
              value: stats.data?.tournaments ?? "—",
              icon: Trophy,
            },
            {
              label: "Ro‘yxatdan o‘tgan o‘yinchilar",
              value: stats.data?.players ?? "—",
              icon: Users,
            },
            {
              label: "O‘tkazilgan o‘yinlar",
              value: stats.data?.matches ?? "—",
              icon: Gamepad2,
            },
            {
              label: "Jamoalar",
              value: stats.data?.teams ?? "—",
              icon: Medal,
            },
          ].map((s) => (
            <StatCard key={s.label} {...s} />
          ))}
        </section>
        <section className="section">
          <div className="section-heading">
            <div>
              <span className="eyebrow">NAVBATDAGI SINOVNI TOPING</span>
              <h2>
                Diqqat markazida<span>.</span>
              </h2>
            </div>
            <Link className="text-link" href="/tournaments">
              Barcha turnirlar{" "}
              <span className="count-pill">{tournaments.data?.total || 0}</span>
            </Link>
          </div>
          {tournaments.loading ? (
            <Loading />
          ) : tournaments.error ? (
            <ErrorState
              message={tournaments.error}
              retry={tournaments.reload}
            />
          ) : (
            <div className="tournament-grid">
              {tournaments.data?.items
                .slice()
                .sort((a,b)=>(a.status==='live'?-1:b.status==='live'?1:0))
                .slice(0, 3)
                .map((t) => (
                  <TournamentCard t={t} key={t.id} />
                ))}
            </div>
          )}
        </section>
        <HomeActivity/>
        <MediaSection compact/>
        <section className="section why-section">
          <div>
            <span className="eyebrow">KAMROQ TO‘SIQ. KO‘PROQ RAQOBAT.</span>
            <h2>
              Raqobatbardoshlar uchun
              <br />
              yaratilgan<span>.</span>
            </h2>
            <p>
              Birinchi hushtakdan so‘nggi kubokkacha.
              <br />
              Turniringizning har bir bosqichi uchun yagona maskan.
            </p>
            <Link href="/admin/new" className="text-link">
              Turniringizni yarating
            </Link>
          </div>
          <div className="feature-grid">
            {[
              {
                icon: Network,
                title: "Avtomatik turnir setkasi",
                text: "Chempionlik sari yo‘l tartibli. G‘oliblar avtomatik tarzda keyingi bosqichga chiqadi.",
              },
              {
                icon: Gamepad2,
                title: "O‘yinlar boshqaruvi",
                text: "Jadvallar, hisoblar va natijalarni tasdiqlash bir joyda.",
              },
              {
                icon: BarChart3,
                title: "Jonli turnir jadvali",
                text: "Har bir gol va ochko hisoblanadi. O‘zgarib borayotgan jadvalni kuzatib boring.",
              },
              {
                icon: Target,
                title: "O‘yinchi statistikasi",
                text: "O‘z formangizni, o‘sishingizni va mag‘lub etilishi kerak bo‘lgan raqiblarni kuzating.",
              },
              {
                icon: Bell,
                title: "Telegram integratsiyasi",
                text: "O‘yin eslatmalari va turnir yangiliklarini to‘g‘ridan-to‘g‘ri Telegram orqali oling.",
              },
              {
                icon: Smartphone,
                title: "Har qanday qurilmada tayyor",
                text: "Istalgan ekrandan ro‘yxatdan o‘ting, natijalarni kuzating va bellashing.",
              },
            ].map((f) => (
              <div key={f.title}>
                <f.icon />
                <h3>{f.title}</h3>
                <p>{f.text}</p>
              </div>
            ))}
          </div>
        </section>
        <section className="final-cta">
          <div>
            <span className="eyebrow">SIZNING LAHZANGIZ KUTILMOQDA</span>
            <h2>BELLASHISHGA TAYYORMISIZ?</h2>
          </div>
          <Button asChild>
            <Link href="/tournaments">
              Arenangizni toping <Trophy size={18} />
            </Link>
          </Button>
        </section>
      </div>
    </Shell>
  );
}

export function Tournaments() {
  const [q, setQ] = useState(""),
    [game, setGame] = useState(""),
    [status, setStatus] = useState(""),
    [page, setPage] = useState(1);
  const result = useApi<{ items: Tournament[]; total: number }>(
    `/tournaments?q=${encodeURIComponent(q)}&game=${game}&status=${status}&page=${page}&page_size=6`,
  );
  return (
    <Shell>
      <div className="container page">
        <div className="page-heading">
          <div>
            <span className="eyebrow">MAYDONINGIZNI TANLANG</span>
            <h1>
              Arenangizni toping<span>.</span>
            </h1>
            <p>Haqiqiy raqiblar. Yangi chempionlik unvoni.</p>
          </div>
          <Button asChild>
            <Link href="/admin/new">Turnir yaratish</Link>
          </Button>
        </div>
        <div className="filters">
          <label className="search">
            <Search size={18} />
            <input
              value={q}
              onChange={(e) => {
                setQ(e.target.value);
                setPage(1);
              }}
              placeholder="Turnirlarni qidirish"
              aria-label="Turnirlarni qidirish"
            />
          </label>
          <div className="segmented">
            {[
              ["", "Barcha o‘yinlar"],
              ["efootball", "eFootball"],
              ["pubg", "PUBG Mobile"],
            ].map(([v, l]) => (
              <button
                className={game === v ? "selected" : ""}
                key={v}
                onClick={() => {
                  setGame(v);
                  setPage(1);
                }}
              >
                {l}
              </button>
            ))}
          </div>
          <label className="select-with-icon">
            <SlidersHorizontal size={16} />
            <select
              aria-label="Turnir holati"
              value={status}
              onChange={(e) => {
                setStatus(e.target.value);
                setPage(1);
              }}
            >
              <option value="">Barcha holatlar</option>
              <option value="registration">Ro‘yxatdan o‘tish</option>
              <option value="upcoming">Yaqinlashayotgan</option>
              <option value="live">Jonli</option>
              <option value="finished">Yakunlangan</option>
            </select>
          </label>
        </div>
        {result.loading ? (
          <Loading />
        ) : result.error ? (
          <ErrorState message={result.error} retry={result.reload} />
        ) : result.data?.items.length ? (
          <div className="tournament-grid">
            {result.data.items.map((t) => (
              <TournamentCard t={t} key={t.id} />
            ))}
          </div>
        ) : (
          <Empty
            title="Turnirlar topilmadi"
            detail="Boshqa o‘yinni tanlang yoki qidiruv so‘zini tozalang."
          />
        )}
        <div className="pagination">
          <Button
            variant="secondary"
            disabled={page === 1}
            onClick={() => setPage(page - 1)}
          >
            Oldingi
          </Button>
          <span>{page}-sahifa</span>
          <Button
            variant="secondary"
            disabled={page * 6 >= (result.data?.total || 0)}
            onClick={() => setPage(page + 1)}
          >
            Keyingi
          </Button>
        </div>
      </div>
    </Shell>
  );
}

export function LiveCenter() {
  const result = useApi<Match[]>("/matches?page_size=100", 15000),
    [filter, setFilter] = useState("live");
  const shown = result.data?.filter(
    (m) => filter === "all" || m.status === filter,
  );
  const filterButtons = [
    { key: "live", label: "Jonli" },
    { key: "scheduled", label: "Rejalashtirilgan" },
    { key: "completed", label: "Yakunlangan" },
    { key: "all", label: "Barcha o‘yinlar" },
  ];
  return (
    <Shell>
      <div className="container page">
        <div className="page-heading">
          <div>
            <span className="eyebrow">
              <Radio size={14} /> HAR BIR LAHZA MUHIM
            </span>
            <h1>
              O‘yinlar markazi<span>.</span>
            </h1>
            <p>Qizg‘in bahslar jonli efirda. Hisoblar har 15 soniyada yangilanadi.</p>
          </div>
          <Badge status="live" />
        </div>
        <div className="segmented fit">
          {filterButtons.map(({ key, label }) => (
            <button
              key={key}
              className={key === filter ? "selected" : ""}
              onClick={() => setFilter(key)}
            >
              {label}
            </button>
          ))}
        </div>
        {result.loading ? (
          <Loading />
        ) : result.error ? (
          <ErrorState message={result.error} retry={result.reload} />
        ) : shown?.length ? (
          <div className="match-grid live-grid">
            {shown.map((m) => (
              <MatchCard key={m.id} match={m} />
            ))}
          </div>
        ) : (
          <Empty
            title="Qizg‘in bahslar oldidan sukunat"
            detail="Navbatdagi o‘yinlar boshlanish vaqtini ko‘rish uchun rejalashtirilgan o‘yinlarni tekshiring."
            icon={Radio}
          />
        )}
      </div>
    </Shell>
  );
}

export function Leaderboard() {
  const result = useApi<Player[]>("/leaderboard"),
    [sort, setSort] = useState("points"),
    [q, setQ] = useState("");
  const rows = [...(result.data || [])]
    .filter((p) => p.nickname.toLowerCase().includes(q.toLowerCase()))
    .sort(
      (a, b) =>
        Number(b[sort as keyof Player]) - Number(a[sort as keyof Player]),
    );
  const sortColumns = [
    { key: "matches", label: "O‘yinlar" },
    { key: "wins", label: "G‘alaba" },
    { key: "losses", label: "Mag‘lubiyat" },
    { key: "win_rate", label: "G‘alaba %" },
    { key: "points", label: "Ochko" },
  ];
  return (
    <Shell>
      <div className="container page">
        <div className="page-heading">
          <div>
            <span className="eyebrow">O‘Z O‘RNINGIZNI EGALLANG</span>
            <h1>
              Yetakchilar safida<span>.</span>
            </h1>
            <p>Natijalar so‘zlaydi. Eng yuqori darajani ko‘rsatayotgan o‘yinchilar bilan tanishing.</p>
          </div>
          <Trophy className="page-emblem" />
        </div>
        {result.loading ? (
          <Loading />
        ) : result.error ? (
          <ErrorState message={result.error} retry={result.reload} />
        ) : (
          <>
            <div className="podium">
              {[1, 0, 2].map(
                (i) =>
                  result.data?.[i] && (
                    <Link
                      key={i}
                      href={`/players/${result.data[i].nickname}`}
                      className={`podium-card place-${i + 1}`}
                    >
                      <span className="podium-place">
                        <Medal size={20} />
                        {String(i + 1).padStart(2, "0")}
                      </span>
                      <Avatar size="large" name={result.data[i].nickname} />
                      <h2>{result.data[i].nickname}</h2>
                      <p>{result.data[i].region}</p>
                      <strong>
                        {result.data[i].points}
                        <small> OCHKO</small>
                      </strong>
                      <span className="podium-footer">
                        {result.data[i].wins} G‘ALABA
                        <span>{result.data[i].win_rate}% G‘ALABA KO‘RSATKICHI</span>
                      </span>
                    </Link>
                  ),
              )}
            </div>
            <div className="panel">
              <div className="panel-heading">
                <h3>O‘yinchilar reytingi</h3>
                <label className="search">
                  <Search size={16} />
                  <input
                    value={q}
                    onChange={(e) => setQ(e.target.value)}
                    placeholder="O‘yinchini qidirish"
                    aria-label="O‘yinchini qidirish"
                  />
                </label>
              </div>
              <div className="table-scroll">
                <table>
                  <thead>
                    <tr>
                      <th>O‘rin</th>
                      <th>O‘yinchi</th>
                      {sortColumns.map(({ key, label }) => (
                        <th key={key}>
                          <button onClick={() => setSort(key)}>
                            {label}
                            {sort === key ? " ↓" : ""}
                          </button>
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((p, i) => (
                      <tr key={p.id}>
                        <td className="rank-number">
                          {String(i + 1).padStart(2, "0")}
                        </td>
                        <td>
                          <Link
                            href={`/players/${p.nickname}`}
                            className="table-player"
                          >
                            <Avatar name={p.nickname} size="small" />
                            {p.nickname}
                          </Link>
                        </td>
                        <td>{p.matches}</td>
                        <td>{p.wins}</td>
                        <td>{p.losses}</td>
                        <td>{p.win_rate}%</td>
                        <td className="points">{p.points}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {!rows.length && (
                <Empty
                  title="O‘yinchilar topilmadi"
                  detail="Boshqa taxallus bilan qidirib ko‘ring."
                />
              )}
            </div>
          </>
        )}
      </div>
    </Shell>
  );
}
