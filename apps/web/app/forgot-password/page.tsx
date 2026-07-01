"use client";

import { useState } from "react";
import Link from "next/link";
import { supabase, isSupabaseConfigured } from "@/lib/supabaseClient";
import { useTr, useCommon } from "@/lib/i18n";
import { AuthShell } from "@/components/auth/AuthShell";
import { Button } from "@/components/ds/Button";
import { Input } from "@/components/ds/Input";
import { Field } from "@/components/ds/Field";

const M = {
  en: {
    title: "Reset your password",
    subtitle: "We'll email you a link to set a new one",
    sentPrefix: "If an account exists for",
    sentSuffix: ", a reset link is on its way. Check your inbox.",
    sendLink: "Send reset link",
    sending: "Sending…",
    notConfigured:
      "Supabase is not configured. Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY in apps/web/.env.local.",
    remembered: "Remembered it?",
    backToSignIn: "Back to sign in",
  },
  bg: {
    title: "Възстановяване на паролата",
    subtitle: "Ще ви изпратим имейл с връзка за задаване на нова",
    sentPrefix: "Ако съществува профил за",
    sentSuffix: ", връзката за възстановяване вече е на път. Проверете пощата си.",
    sendLink: "Изпрати връзка за възстановяване",
    sending: "Изпращане…",
    notConfigured:
      "Supabase не е конфигуриран. Задайте NEXT_PUBLIC_SUPABASE_URL и NEXT_PUBLIC_SUPABASE_ANON_KEY в apps/web/.env.local.",
    remembered: "Сетихте ли се?",
    backToSignIn: "Обратно към входа",
  },
} as const;

export default function ForgotPasswordPage() {
  const t = useTr(M);
  const c = useCommon();
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!supabase) {
      setError(t.notConfigured);
      return;
    }
    setError(null);
    setLoading(true);
    const redirectTo =
      typeof window !== "undefined" ? `${window.location.origin}/reset-password` : undefined;
    const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo });
    setLoading(false);
    if (error) {
      setError(error.message);
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
        <p style={{ fontSize: 14, color: "var(--text-body)", margin: 0 }}>
          {t.sentPrefix} <strong>{email}</strong>{t.sentSuffix}
        </p>
      ) : (
        <form onSubmit={onSubmit} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <Field label={c.email} htmlFor="email">
            <Input id="email" type="email" size="lg" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@restaurant.bg" />
          </Field>
          {error && <p style={{ fontSize: 13, color: "var(--red-600)", margin: 0 }}>{error}</p>}
          <Button type="submit" variant="primary" size="lg" disabled={loading || !isSupabaseConfigured} style={{ width: "100%", marginTop: 2 }}>
            {loading ? t.sending : t.sendLink}
          </Button>
        </form>
      )}
    </AuthShell>
  );
}
