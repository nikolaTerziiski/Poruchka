"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { supabase, isSupabaseConfigured } from "@/lib/supabaseClient";
import { Button, Input, Label, Card } from "@/components/ui";

export default function RegisterPage() {
  const router = useRouter();
  const [restaurant, setRestaurant] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setNotice(null);
    setLoading(true);
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { restaurant_name: restaurant } },
    });
    setLoading(false);
    if (error) {
      setError(error.message);
      return;
    }
    // If email confirmation is on, there's no session yet.
    if (data.session) {
      router.push("/dashboard");
    } else {
      setNotice(
        "Account created. Check your email to confirm, then sign in.",
      );
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center px-4">
      <div className="w-full max-w-md">
        <div className="mb-8 text-center">
          <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-indigo-600 text-xl font-bold text-white">
            P
          </div>
          <h1 className="text-2xl font-semibold text-slate-900">
            Create your restaurant
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            Start sending ordering reminders in minutes
          </p>
        </div>

        <Card className="p-6">
          {!isSupabaseConfigured && (
            <div className="mb-4 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-700">
              Supabase anon key not configured yet — set
              NEXT_PUBLIC_SUPABASE_ANON_KEY in apps/web/.env.local to enable
              registration.
            </div>
          )}
          <form onSubmit={onSubmit} className="space-y-4">
            <div>
              <Label htmlFor="restaurant">Restaurant name</Label>
              <Input
                id="restaurant"
                required
                value={restaurant}
                onChange={(e) => setRestaurant(e.target.value)}
                placeholder="Family Restaurant"
              />
            </div>
            <div>
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@restaurant.bg"
              />
            </div>
            <div>
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                required
                minLength={6}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="At least 6 characters"
              />
            </div>
            {error && <p className="text-sm text-red-600">{error}</p>}
            {notice && <p className="text-sm text-emerald-600">{notice}</p>}
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? "Creating…" : "Create account"}
            </Button>
          </form>
        </Card>

        <p className="mt-6 text-center text-sm text-slate-500">
          Already have an account?{" "}
          <Link href="/login" className="font-medium text-indigo-600 hover:underline">
            Sign in
          </Link>
        </p>
      </div>
    </main>
  );
}
