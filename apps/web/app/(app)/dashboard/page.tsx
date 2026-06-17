"use client";

import { PageHeader, Card } from "@/components/ui";

export default function DashboardPage() {
  return (
    <div>
      <PageHeader
        title="Order calendar"
        subtitle="Upcoming reminders and their status"
      />
      <Card className="flex h-64 items-center justify-center text-sm text-slate-400">
        The calendar will render here once schedules are configured.
      </Card>
    </div>
  );
}
