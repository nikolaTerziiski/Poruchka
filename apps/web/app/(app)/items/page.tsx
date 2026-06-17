"use client";

import { PageHeader, Card } from "@/components/ui";

export default function ItemsPage() {
  return (
    <div>
      <PageHeader title="Items / Menu" subtitle="The goods you order" />
      <Card className="flex h-48 items-center justify-center text-sm text-slate-400">
        Item management — coming next.
      </Card>
    </div>
  );
}
