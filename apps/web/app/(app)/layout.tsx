"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  LayoutDashboard,
  ClipboardList,
  Store,
  Users,
  Settings,
  LogOut,
  Menu,
  X,
} from "lucide-react";
import { supabase, isSupabaseConfigured } from "@/lib/supabaseClient";
import { useTr } from "@/lib/i18n";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";

type NavKey = "overview" | "orders" | "catalog" | "team";

const NAV: { href: string; key: NavKey; Icon: typeof LayoutDashboard }[] = [
  { href: "/dashboard", key: "overview", Icon: LayoutDashboard },
  { href: "/orders", key: "orders", Icon: ClipboardList },
  { href: "/catalog", key: "catalog", Icon: Store },
  { href: "/team", key: "team", Icon: Users },
];

const SESSION_TIMEOUT_MS = 8000;

const M = {
  en: {
    overview: "Overview",
    orders: "Orders",
    catalog: "Catalog",
    team: "Team",
    settings: "Settings",
    loading: "Loading…",
    yourRestaurant: "Your restaurant",
    signOut: "Sign out",
    openMenu: "Open menu",
    closeMenu: "Close menu",
    mainNav: "Main navigation",
    skipToContent: "Skip to content",
  },
  bg: {
    overview: "Преглед",
    orders: "Поръчки",
    catalog: "Каталог",
    team: "Екип",
    settings: "Настройки",
    loading: "Зареждане…",
    yourRestaurant: "Вашият ресторант",
    signOut: "Изход",
    openMenu: "Отвори менюто",
    closeMenu: "Затвори менюто",
    mainNav: "Основна навигация",
    skipToContent: "Към съдържанието",
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
  const menuButtonRef = useRef<HTMLButtonElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const drawerWasOpen = useRef(false);

  useEffect(() => {
    if (!isSupabaseConfigured) {
      setReady(true);
      return;
    }
    if (!supabase) return;
    const client = supabase;
    let cancelled = false;

    async function resolveSession() {
      try {
        const result = await Promise.race([
          client.auth.getSession(),
          new Promise<"timeout">((resolve) => {
            window.setTimeout(() => resolve("timeout"), SESSION_TIMEOUT_MS);
          }),
        ]);
        if (cancelled) return;
        if (result === "timeout" || !result.data.session) {
          setReady(true);
          router.replace("/login");
          return;
        }
        setEmail(result.data.session.user.email ?? null);
        const rn = (result.data.session.user.user_metadata as { restaurant_name?: string })?.restaurant_name;
        if (rn) setRestaurant(rn);
        setReady(true);
      } catch {
        if (!cancelled) {
          setReady(true);
          router.replace("/login");
        }
      }
    }

    void resolveSession();
    // Also fires on USER_UPDATED (email change, restaurant rename) — keep the
    // sidebar identity fresh. Must stay synchronous: awaiting supabase calls
    // inside this callback can deadlock the client.
    const { data: sub } = client.auth.onAuthStateChange((_e, session) => {
      if (!session) {
        router.replace("/login");
        return;
      }
      setEmail(session.user.email ?? null);
      const rn = (session.user.user_metadata as { restaurant_name?: string })?.restaurant_name;
      if (rn) setRestaurant(rn);
    });
    return () => {
      cancelled = true;
      sub.subscription.unsubscribe();
    };
  }, [router]);

  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  // Drawer keyboard contract. It exists because the closed drawer is now
  // visibility:hidden (see the stylesheet below): focus must never be left inside
  // something the browser has just made inert. Escape closes it, focus moves to the
  // close button on open and back to the hamburger on close. The `drawerWasOpen`
  // latch is what keeps the desktop sidebar out of this — `open` is also reset on
  // every navigation, and without the latch that would yank focus to a hidden
  // button on each route change.
  useEffect(() => {
    if (open) {
      drawerWasOpen.current = true;
      const closeButton = closeButtonRef.current;
      if (closeButton) {
        // Reading a layout property flushes the pending style recalc, so the drawer is
        // already visibility:visible by the time we focus. focus() on a still-hidden
        // element is silently a no-op.
        void closeButton.offsetWidth;
        closeButton.focus();
      }
      const onKeyDown = (event: KeyboardEvent) => {
        if (event.key === "Escape") setOpen(false);
      };
      document.addEventListener("keydown", onKeyDown);
      return () => document.removeEventListener("keydown", onKeyDown);
    }
    if (drawerWasOpen.current) {
      drawerWasOpen.current = false;
      const button = menuButtonRef.current;
      // offsetParent is null while the top bar is display:none, i.e. on desktop.
      if (button && button.offsetParent !== null) button.focus();
    }
  }, [open]);

  async function signOut() {
    if (!supabase) return;
    await supabase.auth.signOut();
    router.replace("/login");
  }

  if (!ready) {
    return (
      <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--text-muted)", fontSize: 14 }}>
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

  const isSettings = pathname === "/settings";

  return (
    <div className="app-root">
      <style>{`
        .app-root { display:flex; min-height:100vh; background:var(--surface-page); }
        .app-topbar { display:none; }
        .app-sidebar { width:248px; flex:none; background:var(--surface-card); border-right:1px solid var(--border-subtle); display:flex; flex-direction:column; position:sticky; top:0; height:100vh; z-index:200; }
        .app-main { flex:1; min-width:0; overflow:auto; }
        .app-backdrop { display:none; }
        .app-close { display:none; }

        .skip-link { position:fixed; left:-9999px; top:0; }
        .skip-link:focus { left:12px; top:12px; z-index:500; background:var(--surface-card); color:var(--text-strong); border:1px solid var(--border-default); border-radius:var(--radius-md); padding:10px 14px; font-size:14px; font-weight:600; text-decoration:none; }

        @media (max-width: 1023px) {
          .app-root { flex-direction:column; }
          .app-topbar { display:flex; align-items:center; gap:12px; height:56px; padding:0 16px; position:sticky; top:0; z-index:150; background:color-mix(in srgb, var(--surface-page) 92%, transparent); backdrop-filter:blur(8px); border-bottom:1px solid var(--border-subtle); }
          /* visibility:hidden takes the closed drawer's controls out of BOTH the tab
             order and the accessibility tree; translateX alone left them focusable
             off-screen. The split transition is load-bearing: visible applies instantly
             on open, and is delayed one duration on close so the slide-out still plays. */
          .app-sidebar { position:fixed; top:0; left:0; transform:translateX(-100%); visibility:hidden; transition:transform 220ms var(--ease-out), visibility 0s linear 220ms; box-shadow:var(--shadow-lg); }
          .app-sidebar[data-open="true"] { transform:translateX(0); visibility:visible; transition:transform 220ms var(--ease-out), visibility 0s; }
          .app-backdrop { display:block; position:fixed; inset:0; background:rgba(34,30,24,0.42); backdrop-filter:blur(2px); z-index:190; }
          .app-main { width:100%; }
          .app-close { display:inline-flex; }
        }
      `}</style>

      <a href="#main" className="skip-link">{t.skipToContent}</a>

      {/* Mobile top bar */}
      <div className="app-topbar">
        <button
          ref={menuButtonRef}
          onClick={() => setOpen(true)}
          aria-label={t.openMenu}
          aria-expanded={open}
          aria-controls="app-nav"
          style={{ border: "none", background: "transparent", cursor: "pointer", color: "var(--text-body)", display: "inline-flex", padding: 6 }}
        >
          <Menu size={22} />
        </button>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logomark.svg" width={24} height={24} alt="" />
          <span style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 17, letterSpacing: "-0.02em", color: "var(--text-strong)" }}>Poruchka</span>
        </div>
      </div>

      {open && <div className="app-backdrop" aria-hidden="true" onClick={() => setOpen(false)} />}

      <aside id="app-nav" className="app-sidebar" data-open={open ? "true" : "false"}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "20px 20px 18px" }}>
          <Link href="/dashboard" style={{ display: "flex", alignItems: "center", gap: 10, textDecoration: "none" }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/logomark.svg" width={30} height={30} alt="" />
            <span style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 19, letterSpacing: "-0.02em", color: "var(--text-strong)" }}>Poruchka</span>
          </Link>
          <button ref={closeButtonRef} className="app-close" onClick={() => setOpen(false)} aria-label={t.closeMenu} style={{ border: "none", background: "transparent", cursor: "pointer", color: "var(--text-muted)", padding: 4 }}>
            <X size={18} />
          </button>
        </div>

        <nav aria-label={t.mainNav} style={{ flex: 1, padding: "4px 12px", display: "flex", flexDirection: "column", gap: 2 }}>
          {NAV.map(({ href, key, Icon }) => {
            const on = pathname === href || pathname.startsWith(`${href}/`);
            return (
              <Link
                key={href}
                href={href}
                aria-current={on ? "page" : undefined}
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
          <Link
            href="/settings"
            aria-current={isSettings ? "page" : undefined}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 11,
              padding: "8px 10px",
              borderRadius: "var(--radius-md)",
              textDecoration: "none",
              fontSize: 13.5,
              fontWeight: isSettings ? 600 : 500,
              background: isSettings ? "var(--brand-50)" : "transparent",
              color: isSettings ? "var(--brand-700)" : "var(--text-body)",
            }}
          >
            <Settings size={16} color={isSettings ? "var(--brand-600)" : "var(--text-muted)"} /> {t.settings}
          </Link>
          <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 10px" }}>
            <span style={{ width: 30, height: 30, borderRadius: "var(--radius-pill)", background: "var(--brand-100)", color: "var(--brand-700)", display: "inline-flex", alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: 600, flex: "none" }}>
              {initials}
            </span>
            <span style={{ overflow: "hidden" }}>
              <span style={{ display: "block", fontSize: 13, fontWeight: 600, color: "var(--text-strong)", whiteSpace: "nowrap", textOverflow: "ellipsis", overflow: "hidden" }}>{displayName}</span>
              <span style={{ display: "block", fontSize: 11, color: "var(--text-muted)", whiteSpace: "nowrap", textOverflow: "ellipsis", overflow: "hidden" }}>{email ?? ""}</span>
            </span>
          </div>
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

      <main id="main" tabIndex={-1} className="app-main">{children}</main>
    </div>
  );
}
