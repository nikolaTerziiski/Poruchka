"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  CalendarDays,
  Store,
  Package,
  Repeat,
  Users,
  Bell,
  LogOut,
  Menu,
  X,
} from "lucide-react";
import { supabase, isSupabaseConfigured } from "@/lib/supabaseClient";
import { useTr } from "@/lib/i18n";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";

type NavKey = "calendar" | "suppliers" | "items" | "schedules" | "team" | "notifications";

const NAV: { href: string; key: NavKey; Icon: typeof CalendarDays }[] = [
  { href: "/dashboard", key: "calendar", Icon: CalendarDays },
  { href: "/suppliers", key: "suppliers", Icon: Store },
  { href: "/items", key: "items", Icon: Package },
  { href: "/schedules", key: "schedules", Icon: Repeat },
  { href: "/team", key: "team", Icon: Users },
  { href: "/settings", key: "notifications", Icon: Bell },
];

const M = {
  en: {
    calendar: "Calendar",
    suppliers: "Suppliers",
    items: "Items",
    schedules: "Order plans",
    team: "Team",
    notifications: "Notifications",
    loading: "Loading…",
    yourRestaurant: "Your restaurant",
    signOut: "Sign out",
    openMenu: "Open menu",
    closeMenu: "Close menu",
  },
  bg: {
    calendar: "Календар",
    suppliers: "Доставчици",
    items: "Артикули",
    schedules: "Планове",
    team: "Екип",
    notifications: "Известия",
    loading: "Зареждане…",
    yourRestaurant: "Вашият ресторант",
    signOut: "Изход",
    openMenu: "Отвори менюто",
    closeMenu: "Затвори менюто",
  },
} as const;

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const t = useTr(M);
  const [ready, setReady] = useState(false);
  const [email, setEmail] = useState<string | null>(null);
  const [restaurant, setRestaurant] = useState("");
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!isSupabaseConfigured) {
      setReady(true);
      return;
    }
    if (!supabase) return;
    supabase.auth.getSession().then(({ data }) => {
      if (!data.session) {
        router.replace("/login");
        return;
      }
      setEmail(data.session.user.email ?? null);
      const rn = (data.session.user.user_metadata as { restaurant_name?: string })?.restaurant_name;
      if (rn) setRestaurant(rn);
      setReady(true);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) => {
      if (!session) router.replace("/login");
    });
    return () => sub.subscription.unsubscribe();
  }, [router]);

  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  async function signOut() {
    if (!supabase) return;
    await supabase.auth.signOut();
    router.replace("/login");
  }

  if (!ready) {
    return (
      <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--text-faint)", fontSize: 14 }}>
        {t.loading}
      </div>
    );
  }

  const displayName = restaurant || t.yourRestaurant;
  const initials =
    displayName
      .split(/\s+/)
      .map((w) => w[0])
      .filter(Boolean)
      .slice(0, 2)
      .join("")
      .toUpperCase() || "P";

  const isProfile = pathname === "/profile";

  return (
    <div className="app-root">
      <style>{`
        .app-root { display:flex; min-height:100vh; background:var(--surface-page); }
        .app-topbar { display:none; }
        .app-sidebar { width:248px; flex:none; background:var(--surface-card); border-right:1px solid var(--border-subtle); display:flex; flex-direction:column; position:sticky; top:0; height:100vh; z-index:200; }
        .app-main { flex:1; min-width:0; overflow:auto; }
        .app-backdrop { display:none; }
        .app-close { display:none; }
        @media (max-width: 1023px) {
          .app-root { flex-direction:column; }
          .app-topbar { display:flex; align-items:center; gap:12px; height:56px; padding:0 16px; position:sticky; top:0; z-index:150; background:color-mix(in srgb, var(--surface-page) 92%, transparent); backdrop-filter:blur(8px); border-bottom:1px solid var(--border-subtle); }
          .app-sidebar { position:fixed; top:0; left:0; transform:translateX(-100%); transition:transform 220ms var(--ease-out); box-shadow:var(--shadow-lg); }
          .app-sidebar[data-open="true"] { transform:translateX(0); }
          .app-backdrop { display:block; position:fixed; inset:0; background:rgba(34,30,24,0.42); backdrop-filter:blur(2px); z-index:190; }
          .app-main { width:100%; }
          .app-close { display:inline-flex; }
        }
      `}</style>

      {/* Mobile top bar */}
      <div className="app-topbar">
        <button onClick={() => setOpen(true)} aria-label={t.openMenu} style={{ border: "none", background: "transparent", cursor: "pointer", color: "var(--text-body)", display: "inline-flex", padding: 6 }}>
          <Menu size={22} />
        </button>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logomark.svg" width={24} height={24} alt="" />
          <span style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 17, letterSpacing: "-0.02em", color: "var(--text-strong)" }}>Poruchka</span>
        </div>
      </div>

      {open && <div className="app-backdrop" onClick={() => setOpen(false)} />}

      <aside className="app-sidebar" data-open={open ? "true" : "false"}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "20px 20px 18px" }}>
          <Link href="/dashboard" style={{ display: "flex", alignItems: "center", gap: 10, textDecoration: "none" }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/logomark.svg" width={30} height={30} alt="" />
            <span style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 19, letterSpacing: "-0.02em", color: "var(--text-strong)" }}>Poruchka</span>
          </Link>
          <button className="app-close" onClick={() => setOpen(false)} aria-label={t.closeMenu} style={{ border: "none", background: "transparent", cursor: "pointer", color: "var(--text-muted)", padding: 4 }}>
            <X size={18} />
          </button>
        </div>

        <nav style={{ flex: 1, padding: "4px 12px", display: "flex", flexDirection: "column", gap: 2 }}>
          {NAV.map(({ href, key, Icon }) => {
            const on = pathname === href;
            return (
              <Link
                key={href}
                href={href}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 11,
                  padding: "9px 12px",
                  borderRadius: "var(--radius-md)",
                  textDecoration: "none",
                  fontSize: 14,
                  fontWeight: on ? 600 : 500,
                  background: on ? "var(--brand-50)" : "transparent",
                  color: on ? "var(--brand-700)" : "var(--text-body)",
                }}
              >
                <Icon size={18} color={on ? "var(--brand-600)" : "var(--text-muted)"} />
                {t[key]}
              </Link>
            );
          })}
        </nav>

        <div style={{ borderTop: "1px solid var(--border-subtle)", padding: 12 }}>
          <Link href="/profile" style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 10px", borderRadius: "var(--radius-md)", textDecoration: "none", background: isProfile ? "var(--brand-50)" : "transparent" }}>
            <span style={{ width: 30, height: 30, borderRadius: "var(--radius-pill)", background: "var(--brand-100)", color: "var(--brand-700)", display: "inline-flex", alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: 600, flex: "none" }}>
              {initials}
            </span>
            <span style={{ overflow: "hidden" }}>
              <span style={{ display: "block", fontSize: 13, fontWeight: 600, color: "var(--text-strong)", whiteSpace: "nowrap", textOverflow: "ellipsis", overflow: "hidden" }}>{displayName}</span>
              <span style={{ display: "block", fontSize: 11, color: "var(--text-muted)", whiteSpace: "nowrap", textOverflow: "ellipsis", overflow: "hidden" }}>{email ?? ""}</span>
            </span>
          </Link>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 6, paddingLeft: 4 }}>
            <button
              onClick={signOut}
              style={{ display: "flex", alignItems: "center", gap: 9, padding: "8px 10px", borderRadius: "var(--radius-md)", border: "none", background: "transparent", cursor: "pointer", color: "var(--text-muted)", fontSize: 13, fontWeight: 500 }}
            >
              <LogOut size={16} /> {t.signOut}
            </button>
            <LanguageSwitcher compact />
          </div>
        </div>
      </aside>

      <main className="app-main">{children}</main>
    </div>
  );
}
