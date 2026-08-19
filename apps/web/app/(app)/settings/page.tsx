"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import type { ReactNode } from "react";
import { Check, Lock, LogOut } from "lucide-react";
import { Button } from "@/components/ds/Button";
import { Input } from "@/components/ds/Input";
import { Select } from "@/components/ds/Select";
import { Field } from "@/components/ds/Field";
import { Card } from "@/components/ds/Card";
import { PageHead } from "@/components/ds/PageHead";
import { api } from "@/lib/api";
import { supabase, isSupabaseConfigured } from "@/lib/supabaseClient";
import { useTr, useCommon, useApiError } from "@/lib/i18n";

interface TenantSettings {
  id: string;
  name: string;
  timezone: string;
  language: string;
  quietHoursStart: number;
  quietHoursEnd: number;
  renudgeIntervalMin: number;
  maxNudges: number;
}

interface MeResponse {
  user: { id: string; name: string; role: "OWNER" | "MANAGER" | "STAFF" };
  tenant: TenantSettings;
}

/** Europe/Sofia first, then a curated pan-European set + a few world zones.
 * The stored value is prepended when it isn't listed, so saving another card
 * never silently rewrites an exotic timezone. */
const TIMEZONES = [
  "Europe/Sofia",
  "Europe/Athens",
  "Europe/Bucharest",
  "Europe/Istanbul",
  "Europe/Belgrade",
  "Europe/Skopje",
  "Europe/Zagreb",
  "Europe/Sarajevo",
  "Europe/Tirane",
  "Europe/Chisinau",
  "Europe/Kyiv",
  "Europe/Warsaw",
  "Europe/Prague",
  "Europe/Budapest",
  "Europe/Vienna",
  "Europe/Berlin",
  "Europe/Zurich",
  "Europe/Rome",
  "Europe/Paris",
  "Europe/Brussels",
  "Europe/Amsterdam",
  "Europe/Madrid",
  "Europe/Lisbon",
  "Europe/London",
  "Europe/Dublin",
  "Europe/Stockholm",
  "Europe/Oslo",
  "Europe/Copenhagen",
  "Europe/Helsinki",
  "Europe/Riga",
  "Europe/Vilnius",
  "Europe/Tallinn",
  "America/New_York",
  "America/Chicago",
  "America/Los_Angeles",
  "Asia/Dubai",
];

const NUDGE_INTERVALS = [5, 10, 15, 20, 30, 45, 60, 90, 120, 180, 240, 360, 480, 720];

const M = {
  en: {
    title: "Settings",
    subtitle: "Restaurant, reminder behaviour, and your account",
    staffHint: "Only owners and managers can change these settings.",
    saved: "Saved",
    loadFailed: "Settings could not be loaded. Please try again.",
    saveFailed: "Could not save. Please try again.",
    // Restaurant
    restaurantTitle: "Restaurant",
    restaurantDesc: "Shown in the sidebar and used for reminder timing.",
    nameLabel: "Restaurant name",
    timezoneLabel: "Timezone",
    timezoneHint: "Reminder times follow this timezone.",
    botLangLabel: "Bot message language",
    botLangHint: "Language of the Telegram reminders. The web admin language is switched from the sidebar.",
    langBg: "Bulgarian",
    langEn: "English",
    // Reminders
    notifTitle: "Reminders",
    notifDesc: "When and how persistently the bot reminds your team.",
    quietStartLabel: "Quiet hours start",
    quietEndLabel: "Quiet hours end",
    // Equal start and end would switch quiet hours off entirely — the scheduler
    // reads start === end as "no quiet window", which means 3am reminders.
    quietHelp: "No automatic reminders are sent during this period. The start and end hour must be different.",
    quietSame: "Choose a different start and end hour.",
    quietSameDay: (s: string, e: string) => `No reminders between ${s} and ${e}.`,
    quietOvernight: (s: string, e: string) => `No reminders between ${s} and ${e} (wraps past midnight).`,
    intervalLabel: "Re-nudge interval",
    intervalHint: "How long the bot waits before reminding again.",
    maxNudgesLabel: "Reminders before we notify the backup person",
    maxNudgesHint: "A manual snooze only moves the next reminder — the count is not reset.",
    minutes: (m: number) => `${m} min`,
    hours: (h: number) => (h === 1 ? "1 hour" : `${h} hours`),
    nudges: (n: number) => (n === 1 ? "1 reminder" : `${n} reminders`),
    // Account
    accountTitle: "Your account",
    accountDesc: "Your name appears in reminders and the team list.",
    displayNameLabel: "Display name",
    emailLabel: "New email",
    emailCurrent: (email: string) => `Signed in as ${email}`,
    emailButton: "Change email",
    emailSent: "Confirmation link sent — check your new inbox (and possibly your current one). The change applies once confirmed.",
    passwordLabel: "New password",
    passwordConfirmLabel: "Confirm new password",
    passwordPlaceholder: "At least 6 characters",
    passwordMismatch: "Passwords don't match",
    passwordButton: "Change password",
    passwordChanged: "Password changed",
    signOut: "Sign out",
    notConfigured: "Supabase is not configured in this environment.",
  },
  bg: {
    title: "Настройки",
    subtitle: "Ресторант, напомняния и вашият акаунт",
    staffHint: "Само собственици и мениджъри могат да променят тези настройки.",
    saved: "Запазено",
    loadFailed: "Настройките не се заредиха. Опитайте отново.",
    saveFailed: "Записът не бе успешен. Опитайте отново.",
    restaurantTitle: "Ресторант",
    restaurantDesc: "Показва се в страничната лента и се използва за часовете на напомнянията.",
    nameLabel: "Име на ресторанта",
    timezoneLabel: "Часова зона",
    timezoneHint: "Часовете на напомнянията следват тази зона.",
    botLangLabel: "Език на бот съобщенията",
    botLangHint: "Езикът на напомнянията в Telegram. Езикът на уеб панела се сменя от страничната лента.",
    langBg: "Български",
    langEn: "Английски",
    notifTitle: "Напомняния",
    notifDesc: "Кога и колко настоятелно ботът напомня на екипа.",
    quietStartLabel: "Начало на тихите часове",
    quietEndLabel: "Край на тихите часове",
    quietHelp: "През този период не се изпращат автоматични напомняния. Началният и крайният час трябва да са различни.",
    quietSame: "Изберете различен начален и краен час.",
    quietSameDay: (s: string, e: string) => `Без напомняния между ${s} и ${e}.`,
    quietOvernight: (s: string, e: string) => `Без напомняния между ${s} и ${e} (през нощта).`,
    intervalLabel: "Интервал между напомнянията",
    intervalHint: "Колко време ботът изчаква преди да напомни отново.",
    maxNudgesLabel: "Напомняния, преди да уведомим резервния човек",
    maxNudgesHint: "Ръчното отлагане само измества следващото напомняне — броячът не се нулира.",
    minutes: (m: number) => `${m} мин`,
    hours: (h: number) => (h === 1 ? "1 час" : `${h} часа`),
    nudges: (n: number) => (n === 1 ? "1 напомняне" : `${n} напомняния`),
    accountTitle: "Вашият акаунт",
    accountDesc: "Името ви се показва в напомнянията и списъка на екипа.",
    displayNameLabel: "Име",
    emailLabel: "Нов имейл",
    emailCurrent: (email: string) => `Влезли сте като ${email}`,
    emailButton: "Смени имейла",
    emailSent: "Изпратен е линк за потвърждение — проверете новата си поща (а вероятно и текущата). Промяната влиза в сила след потвърждение.",
    passwordLabel: "Нова парола",
    passwordConfirmLabel: "Потвърдете новата парола",
    passwordPlaceholder: "Поне 6 символа",
    passwordMismatch: "Паролите не съвпадат",
    passwordButton: "Смени паролата",
    passwordChanged: "Паролата е сменена",
    signOut: "Изход",
    notConfigured: "Supabase не е конфигуриран в тази среда.",
  },
} as const;

function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

function hourLabel(h: number): string {
  return `${pad2(h)}:00`;
}

function tzLabel(tz: string): string {
  try {
    const parts = new Intl.DateTimeFormat("en", { timeZone: tz, timeZoneName: "shortOffset" }).formatToParts(new Date());
    const off = parts.find((p) => p.type === "timeZoneName")?.value ?? "";
    return off ? `${tz} (${off})` : tz;
  } catch {
    return tz;
  }
}

function SectionCard({
  title,
  description,
  children,
  footer,
}: {
  title: string;
  description?: string;
  children: ReactNode;
  footer?: ReactNode;
}) {
  return (
    <Card pad="md" style={{ marginBottom: 16 }}>
      <div style={{ marginBottom: 16 }}>
        <div style={{ fontFamily: "var(--font-display)", fontSize: 17, fontWeight: 700, color: "var(--text-strong)" }}>{title}</div>
        {description ? <div style={{ fontSize: 13, color: "var(--text-muted)", marginTop: 3 }}>{description}</div> : null}
      </div>
      {children}
      {footer ? (
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginTop: 18 }}>{footer}</div>
      ) : null}
    </Card>
  );
}

/* The live regions below stay mounted and only their contents change. A region
   inserted together with its text is frequently never announced — which is
   exactly the "saved" case a screen-reader user needs to hear. Empty, they are
   zero-width and only add a trailing flex gap nobody can see. */

function SavedFlash({ show, label }: { show: boolean; label: string }) {
  return (
    <span
      role="status"
      aria-live="polite"
      aria-atomic="true"
      style={{ display: "inline-flex", alignItems: "center", gap: 5, fontSize: 13, color: "var(--status-confirmed-fg)" }}
    >
      {show ? (
        <>
          <Check size={14} aria-hidden="true" /> {label}
        </>
      ) : null}
    </span>
  );
}

function InlineError({ text }: { text: string | null }) {
  return (
    <span role="alert" aria-atomic="true" style={{ fontSize: 13, color: "var(--red-600)" }}>
      {text}
    </span>
  );
}

export default function SettingsPage() {
  const router = useRouter();
  const t = useTr(M);
  const c = useCommon();
  const errText = useApiError();

  const [tenant, setTenant] = useState<TenantSettings | null>(null);
  const [role, setRole] = useState<"OWNER" | "MANAGER" | "STAFF">("OWNER");
  const [email, setEmail] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  // The cause is stored, not the sentence: translating at render time keeps the
  // banner in the current language when the sidebar language switch is used.
  const [loadCause, setLoadCause] = useState<{ cause: unknown } | null>(null);

  // Restaurant card
  const [rName, setRName] = useState("");
  const [rTz, setRTz] = useState("Europe/Sofia");
  const [rLang, setRLang] = useState("bg");
  const [rBusy, setRBusy] = useState(false);
  const [rError, setRError] = useState<string | null>(null);
  const [rSaved, setRSaved] = useState(false);

  // Reminders card
  const [nStart, setNStart] = useState(22);
  const [nEnd, setNEnd] = useState(8);
  const [nInterval, setNInterval] = useState(60);
  const [nMax, setNMax] = useState(5);
  const [nBusy, setNBusy] = useState(false);
  const [nError, setNError] = useState<string | null>(null);
  const [nSaved, setNSaved] = useState(false);

  // Account card
  const [meName, setMeName] = useState("");
  const [meBusy, setMeBusy] = useState(false);
  const [meError, setMeError] = useState<string | null>(null);
  const [meSaved, setMeSaved] = useState(false);
  const [newEmail, setNewEmail] = useState("");
  const [emailBusy, setEmailBusy] = useState(false);
  const [emailError, setEmailError] = useState<string | null>(null);
  const [emailNotice, setEmailNotice] = useState<string | null>(null);
  const [pw, setPw] = useState("");
  const [pw2, setPw2] = useState("");
  const [pwBusy, setPwBusy] = useState(false);
  const [pwError, setPwError] = useState<string | null>(null);
  const [pwSaved, setPwSaved] = useState(false);

  const canEdit = role !== "STAFF";
  const pwMismatch = pw2.length > 0 && pw !== pw2;
  // The scheduler treats start === end as "no quiet window", so an equal pair
  // silently switches quiet hours off. Block it here instead of writing it.
  const quietSame = nStart === nEnd;

  function applyTenant(next: TenantSettings) {
    setTenant(next);
    setRName(next.name);
    setRTz(next.timezone);
    setRLang(next.language);
    setNStart(next.quietHoursStart);
    setNEnd(next.quietHoursEnd);
    setNInterval(next.renudgeIntervalMin);
    setNMax(next.maxNudges);
  }

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const me = await api<MeResponse>("/me");
        if (cancelled) return;
        setRole(me.user.role);
        setMeName(me.user.name);
        applyTenant(me.tenant);
        setLoadCause(null);
        if (supabase) {
          const { data } = await supabase.auth.getSession();
          if (!cancelled) setEmail(data.session?.user.email ?? null);
        }
      } catch (cause) {
        console.error(cause);
        if (!cancelled) setLoadCause({ cause });
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
    // Deliberately empty: this used to depend on a translated string, so flipping
    // the language refetched /me and silently reverted every unsaved edit.
  }, []);

  function flash(setter: (v: boolean) => void) {
    setter(true);
    window.setTimeout(() => setter(false), 1800);
  }

  async function saveRestaurant() {
    if (!tenant) return;
    const patch: Record<string, unknown> = {};
    const name = rName.trim();
    if (name && name !== tenant.name) patch.name = name;
    if (rTz !== tenant.timezone) patch.timezone = rTz;
    if (rLang !== tenant.language) patch.language = rLang;
    if (Object.keys(patch).length === 0) return;
    setRBusy(true);
    setRError(null);
    try {
      const updated = await api<TenantSettings>("/settings", { method: "PATCH", body: JSON.stringify(patch) });
      applyTenant(updated);
      // Keep the sidebar's restaurant name (Supabase user_metadata) in sync.
      if (patch.name && supabase) {
        void supabase.auth.updateUser({ data: { restaurant_name: patch.name } }).catch(() => {});
      }
      flash(setRSaved);
    } catch (cause) {
      setRError(errText(cause, t.saveFailed));
    } finally {
      setRBusy(false);
    }
  }

  async function saveNotifications() {
    if (!tenant || quietSame) return;
    const patch: Record<string, unknown> = {};
    if (nStart !== tenant.quietHoursStart) patch.quietHoursStart = nStart;
    if (nEnd !== tenant.quietHoursEnd) patch.quietHoursEnd = nEnd;
    if (nInterval !== tenant.renudgeIntervalMin) patch.renudgeIntervalMin = nInterval;
    if (nMax !== tenant.maxNudges) patch.maxNudges = nMax;
    if (Object.keys(patch).length === 0) return;
    setNBusy(true);
    setNError(null);
    try {
      const updated = await api<TenantSettings>("/settings", { method: "PATCH", body: JSON.stringify(patch) });
      applyTenant(updated);
      flash(setNSaved);
    } catch (cause) {
      setNError(errText(cause, t.saveFailed));
    } finally {
      setNBusy(false);
    }
  }

  async function saveName() {
    const name = meName.trim();
    if (!name) return;
    setMeBusy(true);
    setMeError(null);
    try {
      await api("/me", { method: "PATCH", body: JSON.stringify({ name }) });
      flash(setMeSaved);
    } catch (cause) {
      setMeError(errText(cause, t.saveFailed));
    } finally {
      setMeBusy(false);
    }
  }

  async function changeEmail() {
    if (!supabase) return;
    const next = newEmail.trim();
    if (!next || !next.includes("@")) return;
    setEmailBusy(true);
    setEmailError(null);
    setEmailNotice(null);
    try {
      const { error } = await supabase.auth.updateUser({ email: next });
      if (error) throw error;
      setNewEmail("");
      setEmailNotice(t.emailSent);
    } catch (cause) {
      // Supabase errors carry English transport text — never show it verbatim.
      console.error(cause);
      setEmailError(errText(cause, t.saveFailed));
    } finally {
      setEmailBusy(false);
    }
  }

  async function changePassword() {
    if (!supabase) return;
    if (!pw || pw !== pw2) return;
    setPwBusy(true);
    setPwError(null);
    try {
      const { error } = await supabase.auth.updateUser({ password: pw });
      if (error) throw error;
      setPw("");
      setPw2("");
      flash(setPwSaved);
    } catch (cause) {
      console.error(cause);
      setPwError(errText(cause, t.saveFailed));
    } finally {
      setPwBusy(false);
    }
  }

  async function signOut() {
    if (!supabase) return;
    await supabase.auth.signOut();
    router.replace("/login");
  }

  const loadError = loadCause ? errText(loadCause.cause, t.loadFailed) : null;

  const quietHint = quietSame
    ? null
    : nStart < nEnd
      ? t.quietSameDay(hourLabel(nStart), hourLabel(nEnd))
      : t.quietOvernight(hourLabel(nStart), hourLabel(nEnd));

  const intervalLabel = (m: number) => (m >= 60 && m % 60 === 0 ? t.hours(m / 60) : t.minutes(m));
  const intervalOptions = NUDGE_INTERVALS.includes(nInterval)
    ? NUDGE_INTERVALS
    : [nInterval, ...NUDGE_INTERVALS].sort((a, b) => a - b);
  const tzOptions = TIMEZONES.includes(rTz) ? TIMEZONES : [rTz, ...TIMEZONES];

  const staffNote = !canEdit ? (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 13, color: "var(--text-muted)" }}>
      <Lock size={13} aria-hidden="true" /> {t.staffHint}
    </span>
  ) : null;

  if (loading) {
    return (
      <div style={{ padding: "32px 36px", maxWidth: 860, margin: "0 auto" }}>
        <PageHead title={t.title} subtitle={t.subtitle} />
        <div style={{ fontSize: 14, color: "var(--text-muted)" }}>{c.loading}</div>
      </div>
    );
  }

  return (
    <div style={{ padding: "32px 36px", maxWidth: 860, margin: "0 auto" }}>
      <PageHead title={t.title} subtitle={t.subtitle} />

      <div role="alert" aria-atomic="true">
        {loadError ? <div style={{ marginBottom: 16, fontSize: 14, color: "var(--red-600)" }}>{loadError}</div> : null}
      </div>

      {tenant ? (
        <>
          <SectionCard
            title={t.restaurantTitle}
            description={t.restaurantDesc}
            footer={
              canEdit ? (
                <>
                  <Button variant="primary" size="md" onClick={saveRestaurant} disabled={rBusy || !rName.trim()}>
                    {rBusy ? c.saving : c.save}
                  </Button>
                  <SavedFlash show={rSaved} label={t.saved} />
                  <InlineError text={rError} />
                </>
              ) : (
                staffNote
              )
            }
          >
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(230px, 1fr))", gap: 14 }}>
              <Field label={t.nameLabel} htmlFor="set-restaurant-name" required>
                <Input
                  id="set-restaurant-name"
                  value={rName}
                  onChange={(e) => setRName(e.target.value)}
                  disabled={!canEdit}
                />
              </Field>
              <Field label={t.timezoneLabel} htmlFor="set-timezone" hint={t.timezoneHint}>
                <Select id="set-timezone" value={rTz} onChange={(e) => setRTz(e.target.value)} disabled={!canEdit}>
                  {tzOptions.map((tz) => (
                    <option key={tz} value={tz}>
                      {tzLabel(tz)}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label={t.botLangLabel} htmlFor="set-bot-lang" hint={t.botLangHint}>
                <Select id="set-bot-lang" value={rLang} onChange={(e) => setRLang(e.target.value)} disabled={!canEdit}>
                  <option value="bg">{t.langBg}</option>
                  <option value="en">{t.langEn}</option>
                </Select>
              </Field>
            </div>
          </SectionCard>

          <SectionCard
            title={t.notifTitle}
            description={t.notifDesc}
            footer={
              canEdit ? (
                <>
                  <Button variant="primary" size="md" onClick={saveNotifications} disabled={nBusy || quietSame}>
                    {nBusy ? c.saving : c.save}
                  </Button>
                  <SavedFlash show={nSaved} label={t.saved} />
                  <InlineError text={nError} />
                </>
              ) : (
                staffNote
              )
            }
          >
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(230px, 1fr))", gap: 14 }}>
              <Field label={t.quietStartLabel} htmlFor="set-quiet-start">
                <Select
                  id="set-quiet-start"
                  value={String(nStart)}
                  invalid={quietSame}
                  aria-invalid={quietSame || undefined}
                  onChange={(e) => setNStart(Number(e.target.value))}
                  disabled={!canEdit}
                >
                  {Array.from({ length: 24 }, (_, h) => (
                    <option key={h} value={h}>
                      {hourLabel(h)}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field
                label={t.quietEndLabel}
                htmlFor="set-quiet-end"
                hint={t.quietHelp}
                error={quietSame ? t.quietSame : undefined}
              >
                <Select
                  id="set-quiet-end"
                  value={String(nEnd)}
                  invalid={quietSame}
                  aria-invalid={quietSame || undefined}
                  onChange={(e) => setNEnd(Number(e.target.value))}
                  disabled={!canEdit}
                >
                  {Array.from({ length: 24 }, (_, h) => (
                    <option key={h} value={h}>
                      {hourLabel(h)}
                    </option>
                  ))}
                </Select>
              </Field>
            </div>
            <div style={{ fontSize: 13, color: "var(--text-muted)", marginTop: 10 }}>{quietHint}</div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(230px, 1fr))", gap: 14, marginTop: 14 }}>
              <Field label={t.intervalLabel} htmlFor="set-interval" hint={t.intervalHint}>
                <Select
                  id="set-interval"
                  value={String(nInterval)}
                  onChange={(e) => setNInterval(Number(e.target.value))}
                  disabled={!canEdit}
                >
                  {intervalOptions.map((m) => (
                    <option key={m} value={m}>
                      {intervalLabel(m)}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label={t.maxNudgesLabel} htmlFor="set-max-nudges" hint={t.maxNudgesHint}>
                <Select
                  id="set-max-nudges"
                  value={String(nMax)}
                  onChange={(e) => setNMax(Number(e.target.value))}
                  disabled={!canEdit}
                >
                  {Array.from({ length: 20 }, (_, i) => i + 1).map((n) => (
                    <option key={n} value={n}>
                      {t.nudges(n)}
                    </option>
                  ))}
                </Select>
              </Field>
            </div>
          </SectionCard>
        </>
      ) : null}

      <SectionCard title={t.accountTitle} description={t.accountDesc}>
        <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
          <div style={{ display: "flex", alignItems: "flex-end", gap: 10, flexWrap: "wrap" }}>
            <Field label={t.displayNameLabel} htmlFor="set-me-name" style={{ flex: 1, minWidth: 230 }}>
              <Input id="set-me-name" value={meName} onChange={(e) => setMeName(e.target.value)} />
            </Field>
            <Button variant="secondary" size="md" onClick={saveName} disabled={meBusy || !meName.trim()}>
              {meBusy ? c.saving : c.save}
            </Button>
            <SavedFlash show={meSaved} label={t.saved} />
          </div>
          <InlineError text={meError} />

          <div style={{ borderTop: "1px solid var(--border-subtle)", paddingTop: 16 }}>
            {email ? <div style={{ fontSize: 13, color: "var(--text-muted)", marginBottom: 10 }}>{t.emailCurrent(email)}</div> : null}
            <div style={{ display: "flex", alignItems: "flex-end", gap: 10, flexWrap: "wrap" }}>
              <Field label={t.emailLabel} htmlFor="set-new-email" style={{ flex: 1, minWidth: 230 }}>
                <Input
                  id="set-new-email"
                  type="email"
                  value={newEmail}
                  onChange={(e) => setNewEmail(e.target.value)}
                  placeholder="name@example.com"
                />
              </Field>
              <Button
                variant="secondary"
                size="md"
                onClick={changeEmail}
                disabled={emailBusy || !newEmail.trim().includes("@") || !isSupabaseConfigured}
              >
                {emailBusy ? c.working : t.emailButton}
              </Button>
            </div>
            <div role="status" aria-live="polite" aria-atomic="true">
              {emailNotice ? (
                <div style={{ marginTop: 10, fontSize: 13, color: "var(--status-confirmed-fg)", background: "var(--status-confirmed-bg)", border: "1px solid var(--status-confirmed-bd)", borderRadius: "var(--radius-md)", padding: "9px 12px" }}>
                  {emailNotice}
                </div>
              ) : null}
            </div>
            <InlineError text={emailError} />
          </div>

          <div style={{ borderTop: "1px solid var(--border-subtle)", paddingTop: 16 }}>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(230px, 1fr))", gap: 14 }}>
              <Field label={t.passwordLabel} htmlFor="set-new-pw">
                <Input
                  id="set-new-pw"
                  type="password"
                  value={pw}
                  onChange={(e) => setPw(e.target.value)}
                  placeholder={t.passwordPlaceholder}
                />
              </Field>
              <Field label={t.passwordConfirmLabel} htmlFor="set-new-pw2" error={pwMismatch ? t.passwordMismatch : undefined}>
                <Input
                  id="set-new-pw2"
                  type="password"
                  value={pw2}
                  onChange={(e) => setPw2(e.target.value)}
                  invalid={pwMismatch}
                  aria-invalid={pwMismatch || undefined}
                />
              </Field>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 12, marginTop: 12 }}>
              <Button
                variant="secondary"
                size="md"
                onClick={changePassword}
                disabled={pwBusy || !pw || pw !== pw2 || !isSupabaseConfigured}
              >
                {pwBusy ? c.working : t.passwordButton}
              </Button>
              <SavedFlash show={pwSaved} label={t.passwordChanged} />
              <InlineError text={pwError} />
            </div>
          </div>

          <div style={{ borderTop: "1px solid var(--border-subtle)", paddingTop: 16, display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 10 }}>
            <Button variant="ghost" size="md" icon={<LogOut size={15} aria-hidden="true" />} onClick={signOut}>
              {t.signOut}
            </Button>
            {!isSupabaseConfigured ? <span style={{ fontSize: 12, color: "var(--text-muted)" }}>{t.notConfigured}</span> : null}
          </div>
        </div>
      </SectionCard>
    </div>
  );
}
