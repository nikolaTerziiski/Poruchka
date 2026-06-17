"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { supabase, isSupabaseConfigured } from "@/lib/supabaseClient";

const NAV = [
  { href: "/dashboard", label: "Calendar", icon: "📅" },
  { href: "/suppliers", label: "Suppliers", icon: "🏪" },
  { href: "/items", label: "Items / Menu", icon: "🥩" },
  { href: "/schedules", label: "Schedules", icon: "🔁" },
  { href: "/team", label: "Team", icon: "👥" },
  { href: "/settings", label: "Notifications", icon: "🔔" },
];

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [ready, setReady] = useState(false);
  const [email, setEmail] = useState<string | null>(null);

  useEffect(() => {
    if (!isSupabaseConfigured) {
      // Allow the shell to render so the UI is visible before the anon key is set.
      setReady(true);
      return;
    }
    supabase.auth.getSession().then(({ data }) => {
      if (!data.session) {
        router.replace("/login");
        return;
      }
      setEmail(data.session.user.email ?? null);
      setReady(true);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) => {
      if (!session) router.replace("/login");
      else setEmail(session.user.email ?? null);
    });
    return () => sub.subscription.unsubscribe();
  }, [router]);

  async function signOut() {
    await supabase.auth.signOut();
    router.replace("/login");
  }

  if (!ready) {
    return (
      <div className="flex min-h-screen items-center justify-center text-sm text-slate-400">
        Loading…
      </div>
    );
  }

  return (
    <div className="flex min-h-screen">
      <aside className="flex w-60 flex-col border-r border-slate-200 bg-white">
        <div className="flex items-center gap-2 px-5 py-5">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-600 text-sm font-bold text-white">
            P
          </div>
          <span className="text-lg font-semibold text-slate-900">Poruchka</span>
        </div>
        <nav className="flex-1 space-y-1 px-3">
          {NAV.map((item) => {
            const active = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition ${
                  active
                    ? "bg-indigo-50 text-indigo-700"
                    : "text-slate-600 hover:bg-slate-100"
                }`}
              >
                <span aria-hidden>{item.icon}</span>
                {item.label}
              </Link>
            );
          })}
        </nav>
        <div className="border-t border-slate-200 p-3">
          <div className="mb-2 truncate px-2 text-xs text-slate-500">
            {email ?? "Not signed in"}
          </div>
          <button
            onClick={signOut}
            className="w-full rounded-lg px-3 py-2 text-left text-sm text-slate-600 hover:bg-slate-100"
          >
            Sign out
          </button>
        </div>
      </aside>
      <main className="flex-1 overflow-auto px-8 py-8">{children}</main>
    </div>
  );
}
