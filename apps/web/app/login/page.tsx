"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { supabase, isSupabaseConfigured } from "@/lib/supabaseClient";
import { useTr, useCommon } from "@/lib/i18n";
import { AuthShell } from "@/components/auth/AuthShell";
import { Button } from "@/components/ds/Button";
import { Input } from "@/components/ds/Input";
import { Field } from "@/components/ds/Field";

const M = {
  en: {
    title: "Welcome back",
    subtitle: "Sign in to manage your ordering reminders",
    notConfigured:
      "Supabase publishable key not configured — set NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY in apps/web/.env.local.",
    forgot: "Forgot password?",
    signIn: "Sign in",
    signingIn: "Signing in…",
    noAccount: "No account?",
    createOne: "Create one",
  },
  bg: {
    title: "Добре дошли отново",
    subtitle: "Влезте, за да управлявате напомнянията за поръчки",
    notConfigured:
      "Публичният ключ за Supabase не е конфигуриран — задайте NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY в apps/web/.env.local.",
    forgot: "Забравена парола?",
    signIn: "Вход",
    signingIn: "Влизане…",
    noAccount: "Нямате профил?",
    createOne: "Създайте",
  },
} as const;

export default function LoginPage() {
  const router = useRouter();
  const t = useTr(M);
  const c = useCommon();
  const [email, setEmail] = useState("");
  const [pw, setPw] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!supabase) {
      setError(t.notConfigured);
      return;
    }
    setError(null);
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password: pw });
    setLoading(false);
    if (error) {
      setError(error.message);
      return;
    }
    router.push("/dashboard");
  }

  return (
    <AuthShell
      title={t.title}
      subtitle={t.subtitle}
      footer={
        <>
          {t.noAccount}{" "}
          <Link href="/register" style={{ fontWeight: 600 }}>
            {t.createOne}
          </Link>
        </>
      }
    >
      {!isSupabaseConfigured && (
        <div style={{ marginBottom: 16, borderRadius: "var(--radius-md)", background: "var(--amber-50)", border: "1px solid var(--amber-100)", color: "var(--amber-700)", padding: "8px 12px", fontSize: 12 }}>
          {t.notConfigured}
        </div>
      )}
      <form onSubmit={onSubmit} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        <Field label={c.email} htmlFor="email">
          <Input id="email" type="email" size="lg" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@restaurant.bg" />
        </Field>
        <Field label={c.password} htmlFor="pw">
          <Input id="pw" type="password" size="lg" required value={pw} onChange={(e) => setPw(e.target.value)} placeholder="••••••••" />
        </Field>
        <div style={{ textAlign: "right", marginTop: -6 }}>
          <Link href="/forgot-password" style={{ fontSize: 13, color: "var(--text-link)" }}>
            {t.forgot}
          </Link>
        </div>
        {error && <p style={{ fontSize: 13, color: "var(--red-600)", margin: 0 }}>{error}</p>}
        <Button type="submit" variant="primary" size="lg" disabled={loading || !isSupabaseConfigured} style={{ width: "100%", marginTop: 2 }}>
          {loading ? t.signingIn : t.signIn}
        </Button>
      </form>
    </AuthShell>
  );
}
