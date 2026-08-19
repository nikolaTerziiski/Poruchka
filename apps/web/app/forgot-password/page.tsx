"use client";

import { useState } from "react";
import type { ReactNode } from "react";
import Link from "next/link";
import { AlertTriangle, Check } from "lucide-react";
import { supabase } from "@/lib/supabaseClient";
import { useTr, useCommon } from "@/lib/i18n";
import { AuthShell } from "@/components/auth/AuthShell";
import { Button } from "@/components/ds/Button";
import { Input } from "@/components/ds/Input";
import { Field } from "@/components/ds/Field";

const M = {
  en: {
    title: "Reset your password",
    subtitle: "We'll email you a link to set a new one",
    emailPlaceholder: "you@restaurant.bg",
    sentPrefix: "If an account exists for",
    sentSuffix:
      ", you'll get a link to set a new password. Check your inbox (and the spam folder).",
    sendLink: "Send reset link",
    sending: "Sending…",
    remembered: "Remembered your password?",
    backToSignIn: "Back to sign in",
    errors: {
      badEmail: "That email address doesn't look valid.",
      rateLimited: "Too many attempts. Wait a moment and try again.",
      generic: "Something went wrong. Try again in a minute.",
    },
  },
  bg: {
    title: "Възстановяване на паролата",
    subtitle: "Ще ви изпратим имейл с връзка за задаване на нова",
    emailPlaceholder: "you@restaurant.bg",
    sentPrefix: "Ако съществува профил за",
    sentSuffix:
      ", ще получите връзка за нова парола. Проверете пощата си (и папка „Спам“).",
    sendLink: "Изпрати връзката",
    sending: "Изпращане…",
    remembered: "Спомнихте ли си паролата?",
    backToSignIn: "Обратно към входа",
    errors: {
      badEmail: "Този имейл адрес изглежда невалиден.",
      rateLimited: "Твърде много опити. Изчакайте малко и опитайте пак.",
      generic: "Нещо се обърка. Опитайте пак след минута.",
    },
  },
} as const;

type ErrKey = keyof (typeof M)["bg"]["errors"];

/** Map a Supabase recovery failure onto our own copy. Everything unrecognised
 *  falls through to `generic` ON PURPOSE: a "no such user" message here would
 *  undo the account-existence hiding that the success copy above is built on.
 *  Never render `error.message` — it is untranslated English. */
function errorKey(error: { code?: string; message?: string }): ErrKey {
  const code = error.code ?? "";
  const msg = error.message ?? "";
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

export default function ForgotPasswordPage() {
  const t = useTr(M);
  const c = useCommon();
  const [email, setEmail] = useState("");
  const [errKey, setErrKey] = useState<ErrKey | null>(null);
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErrKey(null);
    setLoading(true);
    // NOTE: this exact URL must also be on the Supabase project's allow-list
    // (Authentication → URL Configuration → Redirect URLs) for both the dev
    // origin (http://localhost:3002/reset-password) and production. Otherwise
    // Supabase silently ignores `redirectTo` and sends people to the Site URL,
    // and app/reset-password/page.tsx never receives the recovery token.
    const redirectTo =
      typeof window !== "undefined" ? `${window.location.origin}/reset-password` : undefined;
    const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo });
    setLoading(false);
    if (error) {
      if (process.env.NODE_ENV !== "production") console.error("[Poruchka] reset request failed:", error);
      setErrKey(errorKey(error));
      return;
    }
    setSent(true);
  }

  return (
    <AuthShell
      title={t.title}
      subtitle={t.subtitle}
      footer={
        <>
          {t.remembered}{" "}
          <Link href="/login" style={{ fontWeight: 600 }}>
            {t.backToSignIn}
          </Link>
        </>
      }
    >
      {sent ? (
        <Notice tone="success">
          {t.sentPrefix} <strong>{email}</strong>
          {t.sentSuffix}
        </Notice>
      ) : (
        <form onSubmit={onSubmit} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
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
          {errKey && <Notice tone="error">{t.errors[errKey]}</Notice>}
          <Button type="submit" variant="primary" size="lg" disabled={loading} style={{ width: "100%", marginTop: 2 }}>
            {loading ? t.sending : t.sendLink}
          </Button>
        </form>
      )}
    </AuthShell>
  );
}
