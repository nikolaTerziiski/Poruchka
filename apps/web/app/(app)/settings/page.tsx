"use client";

import { useEffect, useState } from "react";
import { Bell } from "lucide-react";
import { Button } from "@/components/ds/Button";
import { Card } from "@/components/ds/Card";
import { Field } from "@/components/ds/Field";
import { Input } from "@/components/ds/Input";
import { PageHead } from "@/components/ds/PageHead";
import { Select } from "@/components/ds/Select";
import { api } from "@/lib/api";
import { useTr, useCommon, useApiError } from "@/lib/i18n";

interface TenantSettings {
  id: string;
  name: string;
  timezone: string;
  quietHoursStart: number;
  quietHoursEnd: number;
  renudgeIntervalMin: number;
  maxNudges: number;
  language: "bg" | "en";
}

interface MeResponse {
  tenant: TenantSettings;
}

/** The zones we offer by name. Bulgaria has exactly one; a list of offset-identical
 *  Balkan neighbours is the kind of choice that makes a non-technical owner freeze.
 *  Anything else already stored is echoed back as its own option so the Select
 *  cannot silently rewrite it. */
const TZ_CHOICES: string[] = ["Europe/Sofia"];

const RENUDGE_MIN = 1;
const RENUDGE_MAX = 1440;
const NUDGES_MIN = 1;
const NUDGES_MAX = 20;

const M = {
  en: {
    title: "Settings",
    subtitle: "Control when reminders repeat and when Poruchka stays quiet",
    loading: "Loading settings…",
    loadFailed: "Settings could not be loaded. Please try again.",
    saved: "Settings saved",
    saveFailed: "Settings could not be saved. Please try again.",
    scheduleTitle: "Reminder behaviour",
    scheduleDescription: "These settings apply to every active order plan in this restaurant.",
    timezone: "Restaurant timezone",
    timezoneSofia: "Sofia (Bulgarian time)",
    timezoneOther: "Other timezone",
    timezoneHint: "Used for the timing of every reminder.",
    language: "Telegram message language",
    bulgarian: "Bulgarian",
    english: "English",
    quietStart: "Quiet hours start",
    quietEnd: "Quiet hours end",
    quietHelp: "No automatic reminders are sent during this period. The start and end hour must be different.",
    quietSame: "Choose a different start and end hour.",
    renudge: "Repeat reminder every",
    minutes: "min",
    maxNudges: "Maximum reminders before we notify the backup person",
    maxHelp:
      "A manual snooze only moves the next reminder — the count before someone else is notified is not reset.",
    range: (min: number, max: number) => `Enter a whole number between ${min} and ${max}.`,
    save: "Save settings",
  },
  bg: {
    title: "Настройки",
    subtitle: "Настройте кога напомнянията се повтарят и кога Poruchka не изпраща съобщения",
    loading: "Зареждане на настройките…",
    loadFailed: "Настройките не се заредиха. Опитайте отново.",
    saved: "Настройките са запазени",
    saveFailed: "Настройките не се запазиха. Опитайте отново.",
    scheduleTitle: "Поведение на напомнянията",
    scheduleDescription: "Тези настройки важат за всички активни планове в ресторанта.",
    timezone: "Часова зона на ресторанта",
    timezoneSofia: "София (българско време)",
    timezoneOther: "Друга часова зона",
    timezoneHint: "Използва се за часовете на всички напомняния.",
    language: "Език на съобщенията в Telegram",
    bulgarian: "Български",
    english: "Английски",
    quietStart: "Начало на тихите часове",
    quietEnd: "Край на тихите часове",
    quietHelp:
      "През този период не се изпращат автоматични напомняния. Началният и крайният час трябва да са различни.",
    quietSame: "Изберете различен начален и краен час.",
    renudge: "Повторно напомняне на всеки",
    minutes: "мин.",
    maxNudges: "Максимален брой напомняния, преди да уведомим резервния човек",
    maxHelp:
      "Ръчното отлагане само измества следващото напомняне — броячът до уведомяването на друг човек не се нулира.",
    range: (min: number, max: number) => `Въведете цяло число между ${min} и ${max}.`,
    save: "Запази настройките",
  },
} as const;

const bannerBase = {
  marginBottom: 18,
  padding: "11px 14px",
  borderRadius: "var(--radius-md)",
  fontSize: 13,
} as const;

export default function SettingsPage() {
  const t = useTr(M);
  const c = useCommon();
  const errText = useApiError();
  const [settings, setSettings] = useState<TenantSettings | null>(null);
  // The two numeric fields are held as text: Number("") is 0, so binding them to a
  // number meant the field snapped to "0" the instant the user selected all and
  // deleted to retype. Parsed and clamped on save instead.
  const [renudgeText, setRenudgeText] = useState("");
  const [maxNudgesText, setMaxNudgesText] = useState("");
  const [loading, setLoading] = useState(true);
  const [loadFailed, setLoadFailed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const applyTenant = (tenant: TenantSettings) => {
    setSettings(tenant);
    setRenudgeText(String(tenant.renudgeIntervalMin));
    setMaxNudgesText(String(tenant.maxNudges));
  };

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const response = await api<MeResponse>("/me");
        if (!cancelled) {
          applyTenant(response.tenant);
          setLoadFailed(false);
        }
      } catch (cause) {
        console.error(cause);
        if (!cancelled) setLoadFailed(true);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
    // Deliberately empty. This used to depend on a translated string, so flipping
    // the language refetched /me and silently reverted every unsaved edit. The
    // failure is stored as a flag and translated at render time instead.
  }, []);

  const update = <K extends keyof TenantSettings>(key: K, value: TenantSettings[K]) => {
    setSettings((current) => (current ? { ...current, [key]: value } : current));
    setSaved(false);
  };

  const renudgeValue = Number(renudgeText.trim());
  const renudgeInvalid =
    !/^\d+$/.test(renudgeText.trim()) || renudgeValue < RENUDGE_MIN || renudgeValue > RENUDGE_MAX;
  const maxNudgesValue = Number(maxNudgesText.trim());
  const maxNudgesInvalid =
    !/^\d+$/.test(maxNudgesText.trim()) || maxNudgesValue < NUDGES_MIN || maxNudgesValue > NUDGES_MAX;
  // The API rejects an equal start and end (me.controller.ts), so block it here
  // rather than let the raw English 400 reach the screen.
  const quietSame = settings ? settings.quietHoursStart === settings.quietHoursEnd : false;
  const cannotSave = loading || busy || !settings || quietSame || renudgeInvalid || maxNudgesInvalid;

  const save = async () => {
    if (!settings || quietSame || renudgeInvalid || maxNudgesInvalid) return;
    setBusy(true);
    setError(null);
    setSaved(false);
    try {
      const updated = await api<TenantSettings>("/me/settings", {
        method: "PATCH",
        body: JSON.stringify({
          timezone: settings.timezone,
          quietHoursStart: settings.quietHoursStart,
          quietHoursEnd: settings.quietHoursEnd,
          renudgeIntervalMin: Math.min(RENUDGE_MAX, Math.max(RENUDGE_MIN, Math.round(renudgeValue) || 60)),
          maxNudges: Math.min(NUDGES_MAX, Math.max(NUDGES_MIN, Math.round(maxNudgesValue) || 3)),
          language: settings.language,
        }),
      });
      applyTenant(updated);
      setSaved(true);
    } catch (cause) {
      setError(errText(cause, t.saveFailed));
    } finally {
      setBusy(false);
    }
  };

  const problem = error ?? (loadFailed ? t.loadFailed : null);

  return (
    <div style={{ padding: "32px 36px", maxWidth: 920, margin: "0 auto" }}>
      <PageHead
        title={t.title}
        subtitle={t.subtitle}
        action={
          <Button
            icon={<Bell size={16} />}
            disabled={cannotSave}
            onClick={() => void save()}
            style={{ minWidth: 170 }}
          >
            {busy ? c.saving : t.save}
          </Button>
        }
      />

      {/* Both regions stay mounted and only their contents change. A live region
          inserted together with its text is frequently never announced, which is
          exactly the "saved" case a screen-reader user needs to hear. */}
      <div role="alert" aria-atomic="true">
        {problem ? (
          <div
            style={{
              ...bannerBase,
              border: "1px solid var(--status-escalated-bd)",
              background: "var(--status-escalated-bg)",
              color: "var(--status-escalated-fg)",
            }}
          >
            {problem}
          </div>
        ) : null}
      </div>
      <div role="status" aria-live="polite" aria-atomic="true">
        {saved ? (
          <div
            style={{
              ...bannerBase,
              border: "1px solid var(--status-confirmed-bd)",
              background: "var(--status-confirmed-bg)",
              color: "var(--status-confirmed-fg)",
            }}
          >
            {t.saved}
          </div>
        ) : null}
      </div>

      {loading ? (
        <Card>
          <div style={{ color: "var(--text-muted)", fontSize: 14 }}>{t.loading}</div>
        </Card>
      ) : settings ? (
        <Card>
          <h2 style={{ margin: 0, fontSize: 19 }}>{t.scheduleTitle}</h2>
          <p style={{ margin: "6px 0 22px", color: "var(--text-muted)", fontSize: 13.5 }}>{t.scheduleDescription}</p>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(230px, 1fr))", gap: 18 }}>
            <Field label={t.timezone} htmlFor="settings-timezone" hint={t.timezoneHint}>
              <Select
                id="settings-timezone"
                value={settings.timezone}
                onChange={(event) => update("timezone", event.target.value)}
              >
                <option value="Europe/Sofia">{t.timezoneSofia}</option>
                {settings.timezone && !TZ_CHOICES.includes(settings.timezone) ? (
                  // A Select whose value matches no option renders the first one,
                  // which would rewrite an unusual zone to Sofia on the next save.
                  <option value={settings.timezone}>{`${t.timezoneOther} (${settings.timezone})`}</option>
                ) : null}
              </Select>
            </Field>
            <Field label={t.language} htmlFor="settings-language">
              <Select id="settings-language" value={settings.language} onChange={(event) => update("language", event.target.value as "bg" | "en")}>
                <option value="bg">{t.bulgarian}</option>
                <option value="en">{t.english}</option>
              </Select>
            </Field>
            <Field label={t.quietStart} htmlFor="settings-quiet-start">
              <Select id="settings-quiet-start" invalid={quietSame} value={String(settings.quietHoursStart)} onChange={(event) => update("quietHoursStart", Number(event.target.value))}>
                {Array.from({ length: 24 }, (_, hour) => (
                  <option key={hour} value={hour}>{String(hour).padStart(2, "0")}:00</option>
                ))}
              </Select>
            </Field>
            <Field
              label={t.quietEnd}
              htmlFor="settings-quiet-end"
              hint={t.quietHelp}
              error={quietSame ? t.quietSame : null}
            >
              <Select id="settings-quiet-end" invalid={quietSame} value={String(settings.quietHoursEnd)} onChange={(event) => update("quietHoursEnd", Number(event.target.value))}>
                {Array.from({ length: 24 }, (_, hour) => (
                  <option key={hour} value={hour}>{String(hour).padStart(2, "0")}:00</option>
                ))}
              </Select>
            </Field>
            <Field
              label={t.renudge}
              htmlFor="settings-renudge"
              error={renudgeInvalid ? t.range(RENUDGE_MIN, RENUDGE_MAX) : null}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <Input
                  id="settings-renudge"
                  type="number"
                  inputMode="numeric"
                  min={RENUDGE_MIN}
                  max={RENUDGE_MAX}
                  invalid={renudgeInvalid}
                  aria-invalid={renudgeInvalid || undefined}
                  value={renudgeText}
                  onChange={(event) => {
                    setRenudgeText(event.target.value);
                    setSaved(false);
                  }}
                />
                <span style={{ color: "var(--text-muted)", fontSize: 13 }}>{t.minutes}</span>
              </div>
            </Field>
            <Field
              label={t.maxNudges}
              htmlFor="settings-max-nudges"
              hint={t.maxHelp}
              error={maxNudgesInvalid ? t.range(NUDGES_MIN, NUDGES_MAX) : null}
            >
              <Input
                id="settings-max-nudges"
                type="number"
                inputMode="numeric"
                min={NUDGES_MIN}
                max={NUDGES_MAX}
                invalid={maxNudgesInvalid}
                aria-invalid={maxNudgesInvalid || undefined}
                value={maxNudgesText}
                onChange={(event) => {
                  setMaxNudgesText(event.target.value);
                  setSaved(false);
                }}
              />
            </Field>
          </div>
        </Card>
      ) : null}
    </div>
  );
}
