"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { AuthShell } from "@/components/auth/AuthShell";
import { Button } from "@/components/ds/Button";
import { Input } from "@/components/ds/Input";
import { Field } from "@/components/ds/Field";
import { Checkbox } from "@/components/ds/Checkbox";

export default function RegisterPage() {
  const router = useRouter();
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
      setNotice("Account created. Check your email to confirm, then sign in.");
    }
  }

  return (
    <AuthShell
      title="Create your restaurant"
      subtitle="Start sending ordering reminders in minutes"
      footer={
        <>
          Already have an account?{" "}
          <Link href="/login" style={{ fontWeight: 600 }}>
            Sign in
          </Link>
        </>
      }
    >
      <form onSubmit={onSubmit} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        <Field label="Restaurant name" htmlFor="rname">
          <Input id="rname" size="lg" required value={restaurant} onChange={(e) => setRestaurant(e.target.value)} placeholder="Mehana Sofia" />
        </Field>
        <Field label="Email" htmlFor="email">
          <Input id="email" type="email" size="lg" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@restaurant.bg" />
        </Field>
        <Field label="Password" htmlFor="pw">
          <Input id="pw" type="password" size="lg" required value={pw} onChange={(e) => setPw(e.target.value)} placeholder="At least 6 characters" />
        </Field>
        <Field label="Confirm password" htmlFor="pw2" error={mismatch ? "Passwords don't match" : undefined}>
          <Input id="pw2" type="password" size="lg" invalid={mismatch} required value={pw2} onChange={(e) => setPw2(e.target.value)} placeholder="••••••••" />
        </Field>
        <Checkbox
          id="agree"
          checked={agree}
          onChange={(e) => setAgree(e.target.checked)}
          label={
            <span>
              I agree to the <Link href="/terms">Terms</Link> &amp; <Link href="/privacy">Privacy Policy</Link>
            </span>
          }
        />
        {error && <p style={{ fontSize: 13, color: "var(--red-600)", margin: 0 }}>{error}</p>}
        {notice && <p style={{ fontSize: 13, color: "var(--green-700)", margin: 0 }}>{notice}</p>}
        <Button type="submit" variant="primary" size="lg" disabled={!canSubmit || loading} style={{ width: "100%", marginTop: 2 }}>
          {loading ? "Creating…" : "Create account"}
        </Button>
      </form>
    </AuthShell>
  );
}
