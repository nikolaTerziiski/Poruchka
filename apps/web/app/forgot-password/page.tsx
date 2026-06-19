"use client";

import { useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabaseClient";
import { AuthShell } from "@/components/auth/AuthShell";
import { Button } from "@/components/ds/Button";
import { Input } from "@/components/ds/Input";
import { Field } from "@/components/ds/Field";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
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
      title="Reset your password"
      subtitle="We'll email you a link to set a new one"
      footer={
        <>
          Remembered it?{" "}
          <Link href="/login" style={{ fontWeight: 600 }}>
            Back to sign in
          </Link>
        </>
      }
    >
      {sent ? (
        <p style={{ fontSize: 14, color: "var(--text-body)", margin: 0 }}>
          If an account exists for <strong>{email}</strong>, a reset link is on its way. Check your inbox.
        </p>
      ) : (
        <form onSubmit={onSubmit} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <Field label="Email" htmlFor="email">
            <Input id="email" type="email" size="lg" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@restaurant.bg" />
          </Field>
          {error && <p style={{ fontSize: 13, color: "var(--red-600)", margin: 0 }}>{error}</p>}
          <Button type="submit" variant="primary" size="lg" disabled={loading} style={{ width: "100%", marginTop: 2 }}>
            {loading ? "Sending…" : "Send reset link"}
          </Button>
        </form>
      )}
    </AuthShell>
  );
}
