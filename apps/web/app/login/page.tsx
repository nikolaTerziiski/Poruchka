"use client";

import { useEffect, useState } from "react";
import type { ReactNode } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AlertTriangle } from "lucide-react";
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
    notConfigured: "The app isn't fully set up yet. Please get in touch with us.",
    emailPlaceholder: "you@restaurant.bg",
    forgot: "Forgot password?",
    signIn: "Sign in",
    signingIn: "Signing in…",
    noAccount: "No account?",
    createOne: "Create an account",
    errors: {
      invalidCredentials: "Wrong email or password.",
      emailNotConfirmed:
        "Your account isn't confirmed yet. Check your inbox and open the confirmation link.",
      rateLimited: "Too many attempts. Wait a moment and try again.",
      generic: "Something went wrong. Try again in a minute.",
    },
  },
  bg: {
    title: "Добре дошли отново",
    subtitle: "Влезте, за да управлявате напомнянията за поръчки",
    notConfigured: "Приложението не е настроено докрай. Свържете се с нас.",
    emailPlaceholder: "you@restaurant.bg",
    forgot: "Забравена парола?",
    signIn: "Вход",
    signingIn: "Влизане…",
    noAccount: "Нямате профил?",
    createOne: "Регистрирайте се",
    errors: {
      invalidCredentials: "Грешен имейл или парола.",
      emailNotConfirmed:
        "Профилът още не е потвърден. Проверете пощата си и отворете връзката за потвърждение.",
      rateLimited: "Твърде много опити. Изчакайте малко и опитайте пак.",
      generic: "Нещо се обърка. Опитайте пак след минута.",
    },
  },
} as const;

type ErrKey = keyof (typeof M)["bg"]["errors"];

/** Map a Supabase auth failure onto our own copy. `code` is the stable signal;
 *  the message regexes are only a safety net for older SDK builds. Never render
 *  `error.message` — it is untranslated English. */
function errorKey(error: { code?: string; message?: string }): ErrKey {
  const code = error.code ?? "";
  const msg = error.message ?? "";
  if (code === "invalid_credentials" || /invalid login credentials/i.test(msg)) {
    return "invalidCredentials";
  }
  if (code === "email_not_confirmed" || /email not confirmed/i.test(msg)) {
    return "emailNotConfirmed";
  }
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
 *  readers rather than being a bare line of red text. */
function Notice({ tone, children }: { tone: "error" | "success" | "warning"; children: ReactNode }) {
  const palette = {
    error: { background: "var(--red-50)", border: "var(--red-100)", color: "var(--red-700)" },
    success: { background: "var(--green-50)", border: "var(--green-100)", color: "var(--green-700)" },
    warning: { background: "var(--amber-50)", border: "var(--amber-100)", color: "var(--amber-700)" },
  }[tone];
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
      <AlertTriangle size={16} style={{ flexShrink: 0, marginTop: 1 }} aria-hidden="true" />
      <span>{children}</span>
    </div>
  );
}

export default function LoginPage() {
  const router = useRouter();
  const t = useTr(M);
  const c = useCommon();
  const [email, setEmail] = useState("");
  const [pw, setPw] = useState("");
  const [errKey, setErrKey] = useState<ErrKey | null>(null);
  const [loading, setLoading] = useState(false);

  // The banner tells the owner to call us; the env-var names belong in the
  // console, where the person who can act on them will look.
  useEffect(() => {
    if (!isSupabaseConfigured) {
      console.error(
        "[Poruchka] Supabase is not configured — set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY in apps/web/.env.local.",
      );
    }
  }, []);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErrKey(null);
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password: pw });
    setLoading(false);
    if (error) {
      if (process.env.NODE_ENV !== "production") console.error("[Poruchka] sign-in failed:", error);
      setErrKey(errorKey(error));
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
        <div style={{ marginBottom: 16 }}>
          <Notice tone="warning">{t.notConfigured}</Notice>
        </div>
      )}
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
        <Field label={c.password} htmlFor="pw">
          <Input
            id="pw"
            name="password"
            type="password"
            autoComplete="current-password"
            size="lg"
            required
            value={pw}
            onChange={(e) => setPw(e.target.value)}
            placeholder="••••••••"
          />
        </Field>
        <div style={{ textAlign: "right", marginTop: -6 }}>
          <Link href="/forgot-password" style={{ fontSize: 13, color: "var(--text-link)" }}>
            {t.forgot}
          </Link>
        </div>
        {errKey && <Notice tone="error">{t.errors[errKey]}</Notice>}
        <Button type="submit" variant="primary" size="lg" disabled={loading} style={{ width: "100%", marginTop: 2 }}>
          {loading ? t.signingIn : t.signIn}
        </Button>
      </form>
    </AuthShell>
  );
}
