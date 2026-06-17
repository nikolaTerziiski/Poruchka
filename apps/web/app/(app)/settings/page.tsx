"use client";

import { PageHeader, Card } from "@/components/ui";

export default function SettingsPage() {
  return (
    <div>
      <PageHeader
        title="Notifications"
        subtitle="Quiet hours, re-nudge interval, and escalation"
      />
      <Card className="flex h-48 items-center justify-center text-sm text-slate-400">
        Notification settings — coming next.
      </Card>
    </div>
  );
}
