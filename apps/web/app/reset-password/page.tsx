"use client";

import { useEffect, useState } from "react";
import type { ReactNode } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AlertTriangle, Check } from "lucide-react";
import { supabase } from "@/lib/supabaseClient";
import { useTr } from "@/lib/i18n";
import { AuthShell } from "@/components/auth/AuthShell";
import { Button } from "@/components/ds/Button";
import { Input } from "@/components/ds/Input";
import { Field } from "@/components/ds/Field";

const MIN_PASSWORD = 6;

const M = {
  en: {
    title: "Set a new password",
    subtitle: "Enter your new password twice so we know it matches",
    checking: "Checking the link…",
    newPassword: "New password",
    confirmPassword: "Confirm new password",
    passwordPlaceholder: "At least 6 characters",
    confirmPlaceholder: "••••••••",
    mismatch: "Passwords don't match",
    tooShort: "The password must be at least 6 characters.",
    save: "Save new password",
    saving: "Saving…",
    expired: "This link has expired or has already been used. Request a new one.",
    requestNew: "Request a new link",
    backToSignIn: "Back to sign in",
    errors: {
      samePassword: "The new password must be different from the old one.",
      weak: "That password is too short — use at least 6 characters.",
      generic: "Something went wrong. Try again in a minute.",
    },
  },
  bg: {
    title: "Задайте нова парола",
    subtitle: "Въведете новата си парола два пъти, за да сме сигурни, че съвпада",
    checking: "Проверяване на връзката…",
    newPassword: "Нова парола",
    confirmPassword: "Потвърдете новата парола",
    passwordPlaceholder: "Поне 6 символа",
    confirmPlaceholder: "••••••••",
    mismatch: "Паролите не съвпадат",
    tooShort: "Паролата трябва да е поне 6 символа.",
    save: "Запазване на новата парола",
    saving: "Запазване…",
    expired: "Връзката е изтекла или вече е използвана. Поискайте нова.",
    requestNew: "Поискайте нова връзка",
    backToSignIn: "Обратно към входа",
    errors: {
      samePassword: "Новата парола трябва да е различна от старата.",
      weak: "Паролата е твърде кратка — използвайте поне 6 символа.",
      generic: "Нещо се обърка. Опитайте пак след минута.",
    },
  },
} as const;

type ErrKey = keyof (typeof M)["bg"]["errors"];

/** Map an updateUser failure onto our own copy. Never render `error.message` —
 *  it is untranslated English. A missing session is handled separately: it means
 *  the recovery link is spent, not that the password was bad. */
function errorKey(error: { code?: string; message?: string }): ErrKey {
  const code = error.code ?? "";
  const msg = error.message ?? "";
  if (code === "same_password" || /different from the old password/i.test(msg)) {
    return "samePassword";
  }
  if (code === "weak_password" || /password should be at least/i.test(msg)) return "weak";
  return "generic";
}

function isMissingSession(error: { code?: string; message?: string }): boolean {
  const code = error.code ?? "";
  return code === "session_not_found" || /session missing/i.test(error.message ?? "");
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

/**
 * Landing page for the link in the "reset your password" email.
 *
 * The URL that gets here is built in app/forgot-password/page.tsx, and it must
 * also be on the Supabase project's Redirect-URL allow-list (Authentication →
 * URL Configuration) for both http://localhost:3002/reset-password and the
 * production origin — otherwise Supabase drops `redirectTo` and the email link
 * lands on the Site URL instead of here.
 */
export default function ResetPasswordPage() {
  const router = useRouter();
  const t = useTr(M);

  // "checking" until we know whether the recovery token produced a session.
  const [status, setStatus] = useState<"checking" | "ready" | "expired">("checking");
  // Read during the first render, not in the effect: a spent or expired link
  // arrives as "#error=access_denied&error_code=otp_expired", and the SDK strips
  // the fragment during its own async init — which can beat useEffect. This does
  // not touch the rendered markup, so it cannot cause a hydration mismatch.
  const [hashError] = useState<string | null>(() => {
    if (typeof window === "undefined" || window.location.hash.length < 2) return null;
    const params = new URLSearchParams(window.location.hash.slice(1));
    return params.get("error_code") ?? params.get("error");
  });
  const [pw, setPw] = useState("");
  const [pw2, setPw2] = useState("");
  const [errKey, setErrKey] = useState<ErrKey | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let cancelled = false;

    // Supabase runs on the implicit flow with detectSessionInUrl, so the SDK
    // consumes "#access_token=…&type=recovery" during its own async init. That
    // can finish BEFORE this listener attaches, which is why getSession() below
    // is not optional — on its own, the listener would leave the page loading
    // forever. Whichever of the two answers first wins.
    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!cancelled && session && !hashError) setStatus("ready");
    });

    supabase.auth
      .getSession()
      .then(({ data }) => {
        if (cancelled) return;
        const ok = Boolean(data.session) && !hashError;
        setStatus((prev) => (prev === "ready" ? prev : ok ? "ready" : "expired"));
      })
      .catch(() => {
        if (!cancelled) setStatus((prev) => (prev === "ready" ? prev : "expired"));
      });

    return () => {
      cancelled = true;
      sub.subscription.unsubscribe();
    };
  }, [hashError]);

  const mismatch = pw2.length > 0 && pw !== pw2;
  const tooShort = pw.length > 0 && pw.length < MIN_PASSWORD;
  const canSubmit = !mismatch && !tooShort && pw.length >= MIN_PASSWORD && pw2.length > 0;

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmit) return;
    setErrKey(null);
    setSaving(true);
    const { error } = await supabase.auth.updateUser({ password: pw });
    setSaving(false);
    if (error) {
      if (process.env.NODE_ENV !== "production") console.error("[Poruchka] password update failed:", error);
      if (isMissingSession(error)) {
        setStatus("expired");
        return;
      }
      setErrKey(errorKey(error));
      return;
    }
    // updateUser succeeded against a live recovery session, so the user is
    // already signed in — sending them to /login would ask for the password
    // they just typed.
    router.replace("/dashboard");
  }

  return (
    <AuthShell
      title={t.title}
      subtitle={t.subtitle}
      footer={
        <Link href="/login" style={{ fontWeight: 600 }}>
          {t.backToSignIn}
        </Link>
      }
    >
      {status === "checking" && (
        <p style={{ fontSize: 14, color: "var(--text-muted)", margin: 0, textAlign: "center" }} role="status">
          {t.checking}
        </p>
      )}

      {status === "expired" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <Notice tone="warning">{t.expired}</Notice>
          <Link href="/forgot-password" style={{ fontSize: 14, fontWeight: 600 }}>
            {t.requestNew}
          </Link>
        </div>
      )}

      {status === "ready" && (
        <form onSubmit={onSubmit} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <Field label={t.newPassword} htmlFor="pw" error={tooShort ? t.tooShort : undefined}>
            <Input
              id="pw"
              name="password"
              type="password"
              autoComplete="new-password"
              size="lg"
              invalid={tooShort}
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
              placeholder={t.confirmPlaceholder}
            />
          </Field>
          {errKey && <Notice tone="error">{t.errors[errKey]}</Notice>}
          <Button
            type="submit"
            variant="primary"
            size="lg"
            disabled={!canSubmit || saving}
            style={{ width: "100%", marginTop: 2 }}
          >
            {saving ? t.saving : t.save}
          </Button>
        </form>
      )}
    </AuthShell>
  );
}
