"use client";

import Link from "next/link";
import { ArrowRight, Check } from "lucide-react";
import type { CSSProperties } from "react";
import { useTr } from "@/lib/i18n";

const M = {
  en: {
    supplier: "Add a supplier",
    item: "Add an item",
    team: "Add a team member and connect Telegram",
    plan: "Create an order plan",
    done: "done",
  },
  bg: {
    supplier: "Добавете доставчик",
    item: "Добавете артикул",
    // "човек от екипа" per docs/BG-TERMINOLOGY.md — bare "човек" is blunt.
    team: "Добавете човек от екипа и свържете Telegram",
    plan: "Създайте план за поръчка",
    done: "готово",
  },
} as const;

export interface SetupChecklistProps {
  /** How many suppliers the tenant already has. */
  suppliers: number;
  /** How many items the tenant already has. */
  items: number;
  /** How many team members the tenant already has. */
  team: number;
  /** Step 4 opens the New order plan dialog in place when the host page owns one.
   *  Without it the step links to /schedules instead. */
  onCreatePlan?: () => void;
  style?: CSSProperties;
}

/**
 * First-run checklist. A brand-new account has no suppliers, items or team, so
 * "New order plan" cannot do anything yet — this replaces the dead disabled
 * button with the four steps that actually get the owner to a working plan.
 * Shared by the Order plans page and the Dashboard empty state.
 */
export function SetupChecklist({ suppliers, items, team, onCreatePlan, style = {} }: SetupChecklistProps) {
  const t = useTr(M);
  const ready = suppliers > 0 && items > 0 && team > 0;

  const steps = [
    { key: "supplier", href: "/suppliers", label: t.supplier, done: suppliers > 0 },
    { key: "item", href: "/items", label: t.item, done: items > 0 },
    { key: "team", href: "/team", label: t.team, done: team > 0 },
    { key: "plan", href: "/schedules", label: t.plan, done: false },
  ];

  return (
    <div className="setup-checklist" style={style}>
      <style>{`
        .setup-checklist { display:flex; flex-direction:column; gap:6px; width:100%; max-width:420px; text-align:left; }
        .setup-checklist-row { display:flex; align-items:center; gap:11px; width:100%; min-height:44px; padding:9px 13px; border:1px solid var(--border-subtle); border-radius:var(--radius-lg); background:var(--surface-card); font-family:var(--font-sans); font-size:var(--text-sm); font-weight:var(--weight-medium); color:var(--text-strong); text-align:left; text-decoration:none; line-height:var(--leading-snug); }
        a.setup-checklist-row, button.setup-checklist-row { cursor:pointer; transition:background var(--dur-fast) var(--ease-out), border-color var(--dur-fast) var(--ease-out); }
        a.setup-checklist-row:hover, button.setup-checklist-row:not(:disabled):hover { background:var(--surface-hover); border-color:var(--border-strong); }
        .setup-checklist-row:focus-visible { outline:2px solid var(--border-focus); outline-offset:2px; box-shadow:none; }
        .setup-checklist-row[data-done="true"] { color:var(--text-muted); background:var(--surface-sunken); }
        .setup-checklist-row:disabled { color:var(--text-muted); background:var(--surface-sunken); cursor:not-allowed; }
        .setup-checklist-mark { display:inline-flex; align-items:center; justify-content:center; width:22px; height:22px; flex:none; border-radius:50%; border:1px solid var(--border-default); background:var(--surface-card); color:var(--text-muted); font-size:var(--text-xs); font-weight:var(--weight-semibold); }
        .setup-checklist-mark[data-done="true"] { background:var(--status-confirmed-bg); border-color:var(--status-confirmed-bd); color:var(--status-confirmed-fg); }
        .setup-checklist-go { margin-left:auto; flex:none; display:inline-flex; color:var(--text-muted); }
      `}</style>

      {steps.map((step, index) => {
        const mark = (
          <span className="setup-checklist-mark" data-done={step.done} aria-hidden="true">
            {step.done ? <Check size={13} strokeWidth={3} /> : index + 1}
          </span>
        );
        const go = (
          <span className="setup-checklist-go" aria-hidden="true">
            <ArrowRight size={15} />
          </span>
        );
        // The visible label is contained in the accessible name, so voice
        // control still matches what the owner reads on screen.
        const name = step.done ? `${step.label} — ${t.done}` : step.label;

        // Step 4 stays disabled until 1-3 are done — but it sits under three
        // live links that say exactly what to do first, so it is a signpost,
        // not the dead end the lone "New order plan" button used to be.
        if (step.key === "plan" && !ready) {
          return (
            <button key={step.key} type="button" className="setup-checklist-row" disabled aria-label={name}>
              {mark}
              <span>{step.label}</span>
            </button>
          );
        }
        if (step.key === "plan" && onCreatePlan) {
          return (
            <button key={step.key} type="button" className="setup-checklist-row" onClick={onCreatePlan} aria-label={name}>
              {mark}
              <span>{step.label}</span>
              {go}
            </button>
          );
        }

        return (
          <Link key={step.key} href={step.href} className="setup-checklist-row" data-done={step.done} aria-label={name}>
            {mark}
            <span>{step.label}</span>
            {go}
          </Link>
        );
      })}
    </div>
  );
}
