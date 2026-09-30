"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import {
  Trophy,
  Radio,
  BarChart3,
  LayoutDashboard,
  Menu,
  X,
  UserRound,
  Gamepad2,
  LogOut,
} from "lucide-react";
import { useAuth } from "./auth-provider";
import { Button } from "./ui/button";

export function Logo() {
  return (
    <Link href="/" className="brand" aria-label="ARENA bosh sahifa">
      <span className="brand-icon">Λ</span>ARENA
      <span className="brand-dot">®</span>
    </Link>
  );
}

const links = [
  { href: "/tournaments", label: "Turnirlar", icon: Trophy },
  { href: "/live", label: "O‘yinlar markazi", icon: Radio },
  { href: "/leaderboard", label: "Reyting", icon: BarChart3 },
];

export function Shell({ children }: { children: React.ReactNode }) {
  const path = usePathname(),
    { user, logout } = useAuth(),
    [open, setOpen] = useState(false);
  return (
    <>
      <header className="site-header">
        <div className="header-inner">
          <Logo />
          <nav
            className={open ? "main-nav open" : "main-nav"}
            aria-label="Asosiy navigatsiya"
          >
            {links.map((l) => (
              <Link
                onClick={() => setOpen(false)}
                className={path.startsWith(l.href) ? "active" : ""}
                key={l.href}
                href={l.href}
              >
                {l.label}
                {l.href === "/live" && <span className="live-dot" />}
              </Link>
            ))}
          </nav>
          <div className="header-actions">
            {user ? (
              <>
                <Link className="profile-chip" href="/profile">
                  <span className="mini-avatar">
                    {user.nickname.slice(0, 2)}
                  </span>
                  <span>{user.nickname}</span>
                </Link>
                <button
                  className="icon-button ghost"
                  aria-label="Chiqish"
                  onClick={() => void logout()}
                >
                  <LogOut size={17} />
                </button>
              </>
            ) : (
              <Button variant="ghost" asChild>
                <Link href="/login">Kirish</Link>
              </Button>
            )}
            <Button size="sm" asChild>
              <Link href="/admin">Tashkilotchi markazi</Link>
            </Button>
            <button
              className="mobile-menu icon-button"
              onClick={() => setOpen(!open)}
              aria-label="Navigatsiyani almashtirish"
            >
              {open ? <X /> : <Menu />}
            </button>
          </div>
        </div>
      </header>
      <main>{children}</main>
      <footer className="site-footer">
        <Logo />
        <p>Navbatdagi chempion shu yerdan boshlanadi.</p>
        <span>© {new Date().getFullYear()} ARENA · Turnir boshqaruvi</span>
      </footer>
      <nav className="bottom-nav" aria-label="Mobil navigatsiya">
        <Link href="/">
          <Gamepad2 />
          Asosiy
        </Link>
        {links.map((l) => (
          <Link
            className={path.startsWith(l.href) ? "active" : ""}
            key={l.href}
            href={l.href}
          >
            <l.icon />
            {l.href === "/live" ? "O‘yinlar" : l.label}
          </Link>
        ))}
        <Link href="/profile">
          <UserRound />
          Profil
        </Link>
      </nav>
    </>
  );
}
