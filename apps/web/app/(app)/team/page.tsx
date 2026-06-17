"use client";

import { PageHeader, Card } from "@/components/ui";

export default function TeamPage() {
  return (
    <div>
      <PageHeader
        title="Team"
        subtitle="People who receive reminders, and their Telegram connection"
      />
      <Card className="flex h-48 items-center justify-center text-sm text-slate-400">
        Team management & Telegram linking — coming next.
      </Card>
    </div>
  );
}
