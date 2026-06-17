"use client";

import { PageHeader, Card } from "@/components/ui";

export default function SchedulesPage() {
  return (
    <div>
      <PageHeader
        title="Schedules"
        subtitle="When each item should be ordered and who is responsible"
      />
      <Card className="flex h-48 items-center justify-center text-sm text-slate-400">
        Schedule management — coming next.
      </Card>
    </div>
  );
}
