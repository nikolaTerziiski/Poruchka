"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle } from "lucide-react";
import { Button } from "@/components/ds/Button";
import { Card } from "@/components/ds/Card";
import { EmptyState } from "@/components/ds/EmptyState";
import { useTr } from "@/lib/i18n";

/* Boundary for the authenticated area. It renders INSIDE app/(app)/layout.tsx,
 * so the sidebar stays on screen and the user can simply pick another section —
 * the best outcome for a non-technical user. The root app/error.tsx would
 * replace the whole shell and strand them on a bare page.
 *
 * "Към календара" matches the sidebar label for /dashboard (app/(app)/layout.tsx
 * calls it "Календар"). Do not write "Табло" or "Начало" — neither word appears
 * in the nav, so it would send the user looking for a screen that does not exist
 * by that name. */
const M = {
  en: {
    title: "Something went wrong",
    body: "This page could not load. Try again, or pick another section from the menu.",
    retry: "Try again",
    home: "Back to calendar",
  },
  bg: {
    title: "Нещо се обърка",
    body: "Страницата не можа да се зареди. Опитайте отново или изберете друг раздел от менюто.",
    retry: "Опитайте отново",
    home: "Към календара",
  },
} as const;

export default function AppError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const t = useTr(M);
  const router = useRouter();

  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <Card pad="none" style={{ maxWidth: 560, margin: "24px auto" }}>
      <EmptyState
        icon={<AlertTriangle size={22} />}
        title={t.title}
        description={t.body}
        action={
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap", justifyContent: "center" }}>
            <Button variant="primary" onClick={() => reset()}>
              {t.retry}
            </Button>
            <Button variant="secondary" onClick={() => router.push("/dashboard")}>
              {t.home}
            </Button>
          </div>
        }
      />
    </Card>
  );
}
