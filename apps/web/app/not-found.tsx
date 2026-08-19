"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { AuthShell } from "@/components/auth/AuthShell";
import { Button } from "@/components/ds/Button";
import { useTr } from "@/lib/i18n";

/* No `export const metadata` here — this is a client component, where that
 * export is illegal. The tab inherits the default title from app/layout.tsx.
 *
 * The primary action goes to "/" and not "/dashboard": app/(app)/layout.tsx
 * bounces unauthenticated visitors to /login, and a logged-out visitor is
 * exactly who lands here (e.g. from a password-reset email), so a /dashboard
 * button would read as a second failure. */
const M = {
  en: {
    title: "Page not found",
    subtitle: "This page doesn't exist or has moved.",
    home: "Back to home",
    login: "Sign in",
  },
  bg: {
    title: "Страницата не е намерена",
    subtitle: "Страницата, която търсите, не съществува или е преместена.",
    home: "Към началото",
    login: "Вход",
  },
} as const;

export default function NotFound() {
  const t = useTr(M);
  const router = useRouter();

  return (
    <AuthShell
      title={t.title}
      subtitle={t.subtitle}
      footer={<Link href="/login">{t.login}</Link>}
    >
      <Button
        variant="primary"
        size="lg"
        onClick={() => router.push("/")}
        style={{ width: "100%" }}
      >
        {t.home}
      </Button>
    </AuthShell>
  );
}
