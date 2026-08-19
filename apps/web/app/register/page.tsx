"use client";

import { useState } from "react";
import type { ReactNode } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AlertTriangle, Check } from "lucide-react";
import { supabase, isSupabaseConfigured } from "@/lib/supabaseClient";
import { useTr, useCommon } from "@/lib/i18n";
import { AuthShell } from "@/components/auth/AuthShell";
import { Button } from "@/components/ds/Button";
import { Input } from "@/components/ds/Input";
import { Field } from "@/components/ds/Field";
import { Checkbox } from "@/components/ds/Checkbox";

const M = {
  en: {
    title: "Create your restaurant",
    subtitle: "Start sending ordering reminders in minutes",
    notConfigured: "The app isn't fully set up yet. Please get in touch with us.",
    restaurantName: "Restaurant name",
    restaurantPlaceholder: "e.g. Mehana Izvorat",
    ownerName: "Your name",
    ownerNamePlaceholder: "e.g. Maria Ivanova",
    emailPlaceholder: "you@restaurant.bg",
    confirmPassword: "Confirm password",
    passwordPlaceholder: "At least 6 characters",
    mismatch: "Passwords don't match",
    agreePrefix: "I agree to the",
    terms: "Terms",
    and: "&",
    privacy: "Privacy Policy",
    newTabHint: "Opens in a new tab.",
    notice: "Account created. Open the email we sent you to confirm it, then sign in.",
    createAccount: "Create account",
    creating: "Creating…",
    haveAccount: "Already have an account?",
    signIn: "Sign in",
    errors: {
      exists: "An account with this email already exists. Try signing in.",
      weak: "That password is too short — use at least 6 characters.",
      badEmail: "That email address doesn't look valid.",
      rateLimited: "Too many attempts. Wait a moment and try again.",
      generic: "Something went wrong. Try again in a minute.",
    },
  },
  bg: {
    title: "Създайте вашия ресторант",
    subtitle: "Само няколко минути и започвате да изпращате напомняния за поръчки",
    notConfigured: "Приложението не е настроено докрай. Свържете се с нас.",
    restaurantName: "Име на ресторанта",
    restaurantPlaceholder: "напр. Механа „Изворът“",
    ownerName: "Вашето име",
    ownerNamePlaceholder: "напр. Мария Иванова",
    emailPlaceholder: "you@restaurant.bg",
    confirmPassword: "Потвърдете паролата",
    passwordPlaceholder: "Поне 6 символа",
    mismatch: "Паролите не съвпадат",
    agreePrefix: "Съгласявам се с",
    terms: "Условията",
    and: "и",
    privacy: "Политиката за поверителност",
    newTabHint: "Отваря се в нов раздел.",
    notice:
      "Профилът е създаден. Отворете имейла, който ви изпратихме, за да го потвърдите, и после влезте.",
    createAccount: "Създай профил",
    creating: "Създаване…",
    haveAccount: "Вече имате профил?",
    signIn: "Вход",
    errors: {
      exists: "Вече има профил с този имейл. Опитайте да влезете.",
      weak: "Паролата е твърде кратка — използвайте поне 6 символа.",
      badEmail: "Този имейл адрес изглежда невалиден.",
      rateLimited: "Твърде много опити. Изчакайте малко и опитайте пак.",
      generic: "Нещо се обърка. Опитайте пак след минута.",
    },
  },
} as const;

type ErrKey = keyof (typeof M)["bg"]["errors"];

/** Map a Supabase sign-up failure onto our own copy. `code` is the stable
 *  signal; the message regexes only cover older SDK builds. Never render
 *  `error.message` — it is untranslated English. */
function errorKey(error: { code?: string; message?: string }): ErrKey {
  const code = error.code ?? "";
  const msg = error.message ?? "";
  if (code === "user_already_exists" || code === "email_exists" || /already registered/i.test(msg)) {
    return "exists";
  }
  if (code === "weak_password" || /password should be at least/i.test(msg)) return "weak";
  if (code === "email_address_invalid" || code === "validation_failed") return "badEmail";
  if (
    code === "over_request_rate_limit" ||
    code === "over_email_send_rate_limit" ||
    /rate limit/i.test(msg)
  ) {
    return "rateLimited";
  }
  return "generic";
}

/** Inline alert for the auth screens: bordered, tinted and announced by screen
 *  readers rather than being a bare line of coloured text. */
function Notice({ tone, children }: { tone: "error" | "success" | "warning"; children: ReactNode }) {
  const palette = {
    error: { background: "var(--red-50)", border: "var(--red-100)", color: "var(--red-700)" },
    success: { background: "var(--green-50)", border: "var(--green-100)", color: "var(--green-700)" },
    warning: { background: "var(--amber-50)", border: "var(--amber-100)", color: "var(--amber-700)" },
  }[tone];
  const Icon = tone === "success" ? Check : AlertTriangle;
  return (
    <div
      role={tone === "error" ? "alert" : "status"}
      aria-live="polite"
      style={{
        display: "flex",
        gap: 8,
        alignItems: "flex-start",
        margin: 0,
        padding: "10px 12px",
        borderRadius: "var(--radius-md)",
        border: `1px solid ${palette.border}`,
        background: palette.background,
        color: palette.color,
        fontSize: 13,
        lineHeight: 1.5,
      }}
    >
      <Icon size={16} style={{ flexShrink: 0, marginTop: 1 }} aria-hidden="true" />
      <span>{children}</span>
    </div>
  );
}

export default function RegisterPage() {
  const router = useRouter();
  const t = useTr(M);
  const c = useCommon();
  const [restaurant, setRestaurant] = useState("");
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [pw, setPw] = useState("");
  const [pw2, setPw2] = useState("");
  const [agree, setAgree] = useState(false);
  const [errKey, setErrKey] = useState<ErrKey | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const mismatch = pw2.length > 0 && pw !== pw2;
  const canSubmit =
    agree &&
    !mismatch &&
    pw.length > 0 &&
    email.length > 0 &&
    restaurant.length > 0 &&
    fullName.trim().length > 0;

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmit) return;
    setErrKey(null);
    setNotice(null);
    setLoading(true);
    const { data, error } = await supabase.auth.signUp({
      email,
      password: pw,
      // `full_name` is what the API turns into the owner's display name
      // (apps/api/src/auth/supabase-auth.guard.ts). Without it the fallback is
      // the email local part, and the team list shows "jockigog" as a person.
      options: { data: { restaurant_name: restaurant, full_name: fullName.trim() } },
    });
    setLoading(false);
    if (error) {
      if (process.env.NODE_ENV !== "production") console.error("[Poruchka] sign-up failed:", error);
      setErrKey(errorKey(error));
      return;
    }
    if (data.session) {
      router.push("/dashboard");
    } else {
      setNotice(t.notice);
    }
  }

  return (
    <AuthShell
      title={t.title}
      subtitle={t.subtitle}
      footer={
        <>
          {t.haveAccount}{" "}
          <Link href="/login" style={{ fontWeight: 600 }}>
            {t.signIn}
          </Link>
        </>
      }
    >
      {!isSupabaseConfigured && (
        <div style={{ marginBottom: 16 }}>
          <Notice tone="warning">{t.notConfigured}</Notice>
        </div>
      )}
      <form onSubmit={onSubmit} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        <Field label={t.restaurantName} htmlFor="rname">
          <Input
            id="rname"
            name="restaurantName"
            autoComplete="organization"
            size="lg"
            required
            value={restaurant}
            onChange={(e) => setRestaurant(e.target.value)}
            placeholder={t.restaurantPlaceholder}
          />
        </Field>
        <Field label={t.ownerName} htmlFor="oname">
          <Input
            id="oname"
            name="name"
            autoComplete="name"
            size="lg"
            required
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            placeholder={t.ownerNamePlaceholder}
          />
        </Field>
        <Field label={c.email} htmlFor="email">
          <Input
            id="email"
            name="email"
            type="email"
            autoComplete="username"
            size="lg"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder={t.emailPlaceholder}
          />
        </Field>
        <Field label={c.password} htmlFor="pw">
          <Input
            id="pw"
            name="password"
            type="password"
            autoComplete="new-password"
            size="lg"
            required
            value={pw}
            onChange={(e) => setPw(e.target.value)}
            placeholder={t.passwordPlaceholder}
          />
        </Field>
        <Field label={t.confirmPassword} htmlFor="pw2" error={mismatch ? t.mismatch : undefined}>
          <Input
            id="pw2"
            name="passwordConfirm"
            type="password"
            autoComplete="new-password"
            size="lg"
            invalid={mismatch}
            required
            value={pw2}
            onChange={(e) => setPw2(e.target.value)}
            placeholder="••••••••"
          />
        </Field>
        <Checkbox
          id="agree"
          checked={agree}
          onChange={(e) => setAgree(e.target.checked)}
          label={
            <span>
              {/* New tab on purpose: this form is uncontrolled state, and a
                  same-tab trip to /terms wipes everything typed so far. */}
              {t.agreePrefix}{" "}
              <Link href="/terms" target="_blank" rel="noopener noreferrer">
                {t.terms}
              </Link>{" "}
              {t.and}{" "}
              <Link href="/privacy" target="_blank" rel="noopener noreferrer">
                {t.privacy}
              </Link>
              <span style={{ display: "block", marginTop: 2, fontSize: "var(--text-xs)", color: "var(--text-muted)" }}>
                {t.newTabHint}
              </span>
            </span>
          }
        />
        {errKey && <Notice tone="error">{t.errors[errKey]}</Notice>}
        {notice && <Notice tone="success">{notice}</Notice>}
        <Button
          type="submit"
          variant="primary"
          size="lg"
          disabled={!canSubmit || loading || !isSupabaseConfigured}
          style={{ width: "100%", marginTop: 2 }}
        >
          {loading ? t.creating : t.createAccount}
        </Button>
      </form>
    </AuthShell>
  );
}
