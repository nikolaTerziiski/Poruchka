"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  CalendarDays,
  ClipboardList,
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
import { DeliveryHealthBanner } from "@/components/DeliveryHealthBanner";

type NavKey = "calendar" | "orders" | "suppliers" | "items" | "schedules" | "team" | "notifications";
type GroupKey = "groupDaily" | "groupSetup";

/**
 * The sidebar is split into "what is happening now" and "what you set up once".
 * Without that split three of the seven entries (Календар, Поръчки, Планове) all
 * read as "orders" to a restaurant owner and the list has to be re-read every time.
 * Grouping is deliberately flat — no expanding sub-trees, which lose this audience.
 */
const NAV_GROUPS: { key: GroupKey; items: { href: string; key: NavKey; Icon: typeof CalendarDays }[] }[] = [
  {
    key: "groupDaily",
    items: [
      { href: "/dashboard", key: "calendar", Icon: CalendarDays },
      { href: "/orders", key: "orders", Icon: ClipboardList },
    ],
  },
  {
    key: "groupSetup",
    items: [
      { href: "/suppliers", key: "suppliers", Icon: Store },
      { href: "/items", key: "items", Icon: Package },
      { href: "/schedules", key: "schedules", Icon: Repeat },
      { href: "/team", key: "team", Icon: Users },
      { href: "/settings", key: "notifications", Icon: Bell },
    ],
  },
];

const M = {
  en: {
    groupDaily: "Day to day",
    groupSetup: "Setup",
    calendar: "Calendar",
    orders: "Orders",
    suppliers: "Suppliers",
    items: "Items",
    schedules: "Order plans",
    team: "Team",
    notifications: "Reminders",
    loading: "Loading…",
    yourRestaurant: "Your restaurant",
    signOut: "Sign out",
    openMenu: "Open menu",
    closeMenu: "Close menu",
    mainNav: "Main navigation",
    skipToContent: "Skip to content",
  },
  bg: {
    groupDaily: "Всеки ден",
    groupSetup: "Настройка",
    calendar: "Календар",
    orders: "Поръчки",
    suppliers: "Доставчици",
    items: "Артикули",
    schedules: "Планове",
    team: "Екип",
    notifications: "Напомняния",
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

  // Drawer keyboard contract: Escape closes it, focus moves to the close button on
  // open and back to the hamburger on close. The `drawerWasOpen` latch is what keeps
  // the desktop sidebar out of this — `open` is also reset on every navigation, and
  // without the latch that would yank focus to a hidden button on each route change.
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

        .app-nav-group { display:flex; flex-direction:column; gap:2px; }
        .app-nav-group + .app-nav-group { margin-top:16px; }
        .app-nav-label { display:block; padding:0 12px 6px; }

        .app-nav-link { display:flex; align-items:center; gap:11px; padding:9px 12px; border-radius:var(--radius-md); text-decoration:none; font-size:14px; font-weight:500; background:transparent; color:var(--text-body); transition:background var(--dur-fast) var(--ease-out), color var(--dur-fast) var(--ease-out); }
        .app-nav-link:hover { background:var(--surface-hover); color:var(--text-strong); text-decoration:none; }
        .app-nav-link:active { background:var(--surface-inset); }
        .app-nav-link[data-active="true"] { font-weight:600; background:var(--brand-50); color:var(--brand-700); }
        .app-nav-link[data-active="true"]:hover { background:var(--brand-100); color:var(--brand-800); }

        .app-account-link { display:flex; align-items:center; gap:10px; padding:8px 10px; border-radius:var(--radius-md); text-decoration:none; background:transparent; transition:background var(--dur-fast) var(--ease-out); }
        .app-account-link:hover { background:var(--surface-hover); text-decoration:none; }

        .app-signout { display:flex; align-items:center; gap:9px; padding:8px 10px; border-radius:var(--radius-md); border:none; background:transparent; cursor:pointer; color:var(--text-muted); font-size:13px; font-weight:500; transition:background var(--dur-fast) var(--ease-out), color var(--dur-fast) var(--ease-out); }
        .app-signout:hover { background:var(--surface-hover); color:var(--text-strong); }

        /* On the drawer a tapped item would otherwise keep its hover fill and read as
           a stuck selection long after the finger has gone. */
        @media (hover: none) {
          .app-nav-link:hover { background:transparent; color:var(--text-body); }
          .app-nav-link[data-active="true"]:hover { background:var(--brand-50); color:var(--brand-700); }
          .app-account-link:hover { background:transparent; }
          .app-signout:hover { background:transparent; color:var(--text-muted); }
        }

        @media (max-width: 1023px) {
          .app-root { flex-direction:column; }
          .app-topbar { display:flex; align-items:center; gap:12px; height:56px; padding:0 16px; position:sticky; top:0; z-index:150; background:color-mix(in srgb, var(--surface-page) 92%, transparent); backdrop-filter:blur(8px); border-bottom:1px solid var(--border-subtle); }
          /* visibility:hidden takes the closed drawer's 13 controls out of BOTH the tab
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

        <nav aria-label={t.mainNav} style={{ flex: 1, padding: "4px 12px" }}>
          {NAV_GROUPS.map((group) => (
            <div key={group.key} className="app-nav-group" role="group" aria-labelledby={`app-nav-${group.key}`}>
              <span id={`app-nav-${group.key}`} className="eyebrow app-nav-label">
                {t[group.key]}
              </span>
              {group.items.map(({ href, key, Icon }) => {
                const on = pathname === href || pathname.startsWith(`${href}/`);
                return (
                  <Link
                    key={href}
                    href={href}
                    className="app-nav-link"
                    data-active={on ? "true" : "false"}
                    aria-current={on ? "page" : undefined}
                  >
                    {/* No `color` prop on purpose: lucide renders it as a literal `stroke`
                        attribute, which would freeze the glyph and kill the hover tint.
                        Without it the icon defaults to currentColor and follows the link. */}
                    <Icon size={18} />
                    {t[key]}
                  </Link>
                );
              })}
            </div>
          ))}
        </nav>

        <div style={{ borderTop: "1px solid var(--border-subtle)", padding: 12 }}>
          {/* No standalone /profile route exists yet, so this card points at Settings —
              but it must NOT paint an active state, or /settings lights up twice at once
              (here and on the Напомняния nav item). Restore it when /profile ships. */}
          <Link href="/settings" className="app-account-link">
            <span style={{ width: 30, height: 30, borderRadius: "var(--radius-pill)", background: "var(--brand-100)", color: "var(--brand-700)", display: "inline-flex", alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: 600, flex: "none" }}>
              {initials}
            </span>
            <span style={{ overflow: "hidden" }}>
              <span style={{ display: "block", fontSize: 13, fontWeight: 600, color: "var(--text-strong)", whiteSpace: "nowrap", textOverflow: "ellipsis", overflow: "hidden" }}>{displayName}</span>
              <span style={{ display: "block", fontSize: 11, color: "var(--text-muted)", whiteSpace: "nowrap", textOverflow: "ellipsis", overflow: "hidden" }}>{email ?? ""}</span>
            </span>
          </Link>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 6, paddingLeft: 4 }}>
            <button className="app-signout" onClick={signOut}>
              <LogOut size={16} /> {t.signOut}
            </button>
            <LanguageSwitcher compact />
          </div>
        </div>
      </aside>

      <main id="main" tabIndex={-1} className="app-main">
        <DeliveryHealthBanner />
        {children}
      </main>
    </div>
  );
}
