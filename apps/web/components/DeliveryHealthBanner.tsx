"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { AlertTriangle } from "lucide-react";
import { api, isApiConfigured } from "@/lib/api";
import { useTr } from "@/lib/i18n";

/**
 * Delivery health.
 *
 * Poruchka's entire value is the reminder actually arriving in Telegram. If nobody
 * has linked a chat, the app looks like it is working — plans save, orders appear —
 * while the scheduler silently drops every message (see apps/api/src/scheduler/
 * scheduler.service.ts, which only logs "no escalation recipient is linked").
 * Nothing else in the web admin surfaces that, so this bar renders inside the app
 * shell and therefore on every authenticated screen.
 *
 * Two tiers:
 *   (a) hard    — no one in the tenant has a chatUserId. Nothing can ever be delivered.
 *   (b) partial — someone is linked, but an active plan's assignee (or the person it
 *                 notifies when nobody reacts) is not. That is the case the scheduler
 *                 log describes, and an "all unlinked" check would never catch it.
 *
 * Hidden on /team, where the same state is already spelled out per person.
 *
 * No API change was needed: /team and /order-rules both already return chatUserId.
 * Every failure here is swallowed — a health banner must never become an error of
 * its own on top of whatever the page is already showing.
 */

type LinkState = { id: string; name: string; chatUserId: string | null };

type TeamMember = { id: string; chatUserId: string | null };

type OrderRule = {
  id: string;
  active: boolean;
  assignedUser: LinkState | null;
  escalationUser: LinkState | null;
};

const M = {
  en: {
    hard: "No one on the team has connected Telegram yet — reminders are not being sent.",
    partialOne: (name: string) => `${name} has not connected Telegram and will not get a reminder.`,
    partialMany: (count: number) =>
      `${count} people on the team have not connected Telegram and will not get reminders.`,
    cta: "Connect Telegram",
  },
  bg: {
    hard: "Никой от екипа още не е свързал Telegram — напомнянията не се изпращат.",
    // Gendered participles are avoided on purpose: "няма свързан Telegram" agrees with
    // Telegram, not with the person, so it reads correctly for a woman too.
    partialOne: (name: string) => `${name} няма свързан Telegram и няма да получи напомняне.`,
    partialMany: (count: number) =>
      `${count} души от екипа нямат свързан Telegram и няма да получат напомняния.`,
    cta: "Свържи Telegram",
  },
} as const;

type Health = { tier: "hard" } | { tier: "partial"; names: string[] } | null;

export function DeliveryHealthBanner() {
  const t = useTr(M);
  const pathname = usePathname();
  const onTeam = pathname === "/team";
  const [health, setHealth] = useState<Health>(null);
  const alive = useRef(true);
  const wasOnTeam = useRef(false);

  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);

  const load = useCallback(async () => {
    if (!isApiConfigured) return;
    try {
      const [team, rules] = await Promise.all([
        api<TeamMember[]>("/team"),
        api<OrderRule[]>("/order-rules"),
      ]);
      if (!alive.current) return;

      // No team yet means no plans yet either (a plan requires an assignee), so there is
      // no reminder to fail. The empty state on /team already tells that story.
      if (team.length === 0) {
        setHealth(null);
        return;
      }
      if (team.every((member) => !member.chatUserId)) {
        setHealth({ tier: "hard" });
        return;
      }

      const unlinked = new Map<string, string>();
      for (const rule of rules) {
        if (!rule.active) continue;
        for (const person of [rule.assignedUser, rule.escalationUser]) {
          if (person && !person.chatUserId) unlinked.set(person.id, person.name);
        }
      }
      setHealth(unlinked.size > 0 ? { tier: "partial", names: [...unlinked.values()] } : null);
    } catch {
      // Offline, misconfigured, or a 401 mid-sign-out. Say nothing rather than
      // claim a delivery problem we cannot actually confirm.
      if (alive.current) setHealth(null);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  // Linking happens on /team, so re-check once the owner navigates away from it.
  useEffect(() => {
    if (wasOnTeam.current && !onTeam) void load();
    wasOnTeam.current = onTeam;
  }, [onTeam, load]);

  if (!health || onTeam) return null;

  const message =
    health.tier === "hard"
      ? t.hard
      : health.names.length === 1
        ? t.partialOne(health.names[0])
        : t.partialMany(health.names.length);

  return (
    <div className="delivery-health" role="status">
      <style>{`
        .delivery-health { display:flex; align-items:center; gap:10px; flex-wrap:wrap; padding:11px 16px; background:var(--status-pending-bg); border-bottom:1px solid var(--status-pending-bd); color:var(--status-pending-fg); font-size:13px; line-height:1.45; }
        .delivery-health-cta { flex:none; display:inline-flex; align-items:center; padding:5px 11px; border:1px solid var(--amber-500); border-radius:var(--radius-md); color:var(--status-pending-fg); background:transparent; font-size:13px; font-weight:600; text-decoration:none; transition:background var(--dur-fast) var(--ease-out); }
        .delivery-health-cta:hover { background:var(--amber-100); text-decoration:none; }
        @media (hover: none) { .delivery-health-cta:hover { background:transparent; } }
      `}</style>
      <AlertTriangle size={16} style={{ flex: "none" }} aria-hidden="true" />
      <span style={{ flex: 1, minWidth: 200 }}>{message}</span>
      <Link href="/team" className="delivery-health-cta">
        {t.cta}
      </Link>
    </div>
  );
}
