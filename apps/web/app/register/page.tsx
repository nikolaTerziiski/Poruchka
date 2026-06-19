"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
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
    restaurantName: "Restaurant name",
    confirmPassword: "Confirm password",
    passwordPlaceholder: "At least 6 characters",
    mismatch: "Passwords don't match",
    agreePrefix: "I agree to the",
    terms: "Terms",
    and: "&",
    privacy: "Privacy Policy",
    notice: "Account created. Check your email to confirm, then sign in.",
    createAccount: "Create account",
    creating: "Creating…",
    haveAccount: "Already have an account?",
    signIn: "Sign in",
  },
  bg: {
    title: "Създайте вашия ресторант",
    subtitle: "Започнете да изпращате напомняния за поръчки за минути",
    restaurantName: "Име на ресторанта",
    confirmPassword: "Потвърдете паролата",
    passwordPlaceholder: "Поне 6 символа",
    mismatch: "Паролите не съвпадат",
    agreePrefix: "Съгласявам се с",
    terms: "Условията",
    and: "и",
    privacy: "Политиката за поверителност",
    notice: "Профилът е създаден. Проверете имейла си за потвърждение и след това влезте.",
    createAccount: "Създаване на профил",
    creating: "Създаване…",
    haveAccount: "Вече имате профил?",
    signIn: "Вход",
  },
} as const;

export default function RegisterPage() {
  const router = useRouter();
  const t = useTr(M);
  const c = useCommon();
  const [restaurant, setRestaurant] = useState("");
  const [email, setEmail] = useState("");
  const [pw, setPw] = useState("");
  const [pw2, setPw2] = useState("");
  const [agree, setAgree] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const mismatch = pw2.length > 0 && pw !== pw2;
  const canSubmit = agree && !mismatch && pw.length > 0 && email.length > 0 && restaurant.length > 0;

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmit) return;
    setError(null);
    setNotice(null);
    setLoading(true);
    const { data, error } = await supabase.auth.signUp({
      email,
      password: pw,
      options: { data: { restaurant_name: restaurant } },
    });
    setLoading(false);
    if (error) {
      setError(error.message);
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
      <form onSubmit={onSubmit} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        <Field label={t.restaurantName} htmlFor="rname">
          <Input id="rname" size="lg" required value={restaurant} onChange={(e) => setRestaurant(e.target.value)} placeholder="Mehana Sofia" />
        </Field>
        <Field label={c.email} htmlFor="email">
          <Input id="email" type="email" size="lg" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@restaurant.bg" />
        </Field>
        <Field label={c.password} htmlFor="pw">
          <Input id="pw" type="password" size="lg" required value={pw} onChange={(e) => setPw(e.target.value)} placeholder={t.passwordPlaceholder} />
        </Field>
        <Field label={t.confirmPassword} htmlFor="pw2" error={mismatch ? t.mismatch : undefined}>
          <Input id="pw2" type="password" size="lg" invalid={mismatch} required value={pw2} onChange={(e) => setPw2(e.target.value)} placeholder="••••••••" />
        </Field>
        <Checkbox
          id="agree"
          checked={agree}
          onChange={(e) => setAgree(e.target.checked)}
          label={
            <span>
              {t.agreePrefix} <Link href="/terms">{t.terms}</Link> {t.and} <Link href="/privacy">{t.privacy}</Link>
            </span>
          }
        />
        {error && <p style={{ fontSize: 13, color: "var(--red-600)", margin: 0 }}>{error}</p>}
        {notice && <p style={{ fontSize: 13, color: "var(--green-700)", margin: 0 }}>{notice}</p>}
        <Button type="submit" variant="primary" size="lg" disabled={!canSubmit || loading} style={{ width: "100%", marginTop: 2 }}>
          {loading ? t.creating : t.createAccount}
        </Button>
      </form>
    </AuthShell>
  );
}
