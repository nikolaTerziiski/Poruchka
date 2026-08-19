"use client";

import { useEffect } from "react";
import Link from "next/link";
import { AuthShell } from "@/components/auth/AuthShell";
import { Button } from "@/components/ds/Button";
import { useTr } from "@/lib/i18n";

/* Catch-all boundary for the public routes (/, /login, /register,
 * /forgot-password, /terms, /privacy). The authenticated area has its own at
 * app/(app)/error.tsx so a signed-in user keeps the sidebar.
 *
 * Scope note: this only catches throws during render. Rejected promises from
 * api() inside a useEffect never reach a boundary — pages still need their own
 * try/catch and inline error state. */
const M = {
  en: {
    title: "Something went wrong",
    body: "This page could not load. Try again, or go back to the start.",
    retry: "Try again",
    home: "Back to home",
  },
  bg: {
    title: "Нещо се обърка",
    body: "Страницата не можа да се зареди. Опитайте отново или се върнете към началото.",
    retry: "Опитайте отново",
    home: "Към началото",
  },
} as const;

export default function RootError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const t = useTr(M);

  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <AuthShell
      title={t.title}
      subtitle={t.body}
      footer={<Link href="/">{t.home}</Link>}
    >
      <Button variant="primary" size="lg" onClick={() => reset()} style={{ width: "100%" }}>
        {t.retry}
      </Button>
    </AuthShell>
  );
}
