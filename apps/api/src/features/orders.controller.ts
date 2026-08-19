import { Controller, Get, Query, UseGuards } from "@nestjs/common";
import { DateTime } from "luxon";
import type { Recurrence } from "@poruchka/shared";
import { SupabaseAuthGuard } from "../auth/supabase-auth.guard";
import { TenantId } from "../auth/request-context";
import { PrismaService } from "../prisma/prisma.service";
import { recurrenceMatchesDate } from "../reminders/recurrence";

interface OrderOccurrenceLine {
  item: string;
  quantity: number | null;
  unit: string | null;
}

interface OrderOccurrence {
  date: string;
  orderRuleId: string;
  supplier: string;
  assignee: string;
  time: string;
  status: string;
  cutoffTime: string | null;
  expectedDeliveryDate: string | null;
  /// Delivery timeline (only meaningful once a run exists; zero/null before).
  sentCount: number;
  lastSentAt: string | null;
  nextNudgeAt: string | null;
  postponedCount: number;
  postponedUntil: string | null;
  submittedAt: string | null;
  submittedBy: string | null;
  lines: OrderOccurrenceLine[];
}

/**
 * Calendar read-model: derives per-supplier order occurrences from active order
 * rules across a date range, overlaying real OrderRun status + snapshotted lines
 * where a run exists. Lets the calendar populate before the scheduler runs.
 */
@UseGuards(SupabaseAuthGuard)
@Controller("orders")
export class OrdersController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  async list(@TenantId() tenantId: string, @Query("from") from?: string, @Query("to") to?: string) {
    const tenant = await this.prisma.tenant.findUnique({ where: { id: tenantId } });
    const zone = tenant?.timezone || "Europe/Sofia";

    const start = (from ? DateTime.fromISO(from, { zone }) : DateTime.now().setZone(zone).startOf("week")).startOf("day");
    const end = (to ? DateTime.fromISO(to, { zone }) : start.plus({ days: 6 })).startOf("day");

    const [rules, runs] = await Promise.all([
      this.prisma.orderRule.findMany({
        where: { tenantId, active: true, archivedAt: null },
        include: {
          supplier: { select: { name: true } },
          assignedUser: { select: { name: true } },
          lines: { include: { item: { select: { name: true, unit: true } } }, orderBy: { sortOrder: "asc" } },
        },
      }),
      this.prisma.orderRun.findMany({
        where: { tenantId, dueDate: { gte: start.toJSDate(), lte: end.endOf("day").toJSDate() } },
        include: {
          supplier: { select: { name: true } },
          assignedUser: { select: { name: true } },
          submittedByUser: { select: { name: true } },
          orderRule: { select: { cutoffTime: true } },
          lines: { orderBy: { sortOrder: "asc" } },
        },
      }),
    ]);

    const out: OrderOccurrence[] = [];
    const runKeys = new Set<string>();

    for (const run of runs) {
      const date = DateTime.fromJSDate(run.dueDate, { zone }).toISODate() ?? "";
      runKeys.add(`${run.orderRuleId}:${date}`);
      out.push({
        date,
        orderRuleId: run.orderRuleId,
        supplier: run.supplier.name,
        assignee: run.assignedUser.name,
        time: DateTime.fromJSDate(run.dueAt).setZone(zone).toFormat("HH:mm"),
        status: run.status.toLowerCase(),
        cutoffTime: run.orderRule.cutoffTime,
        expectedDeliveryDate: run.expectedDeliveryDate
          ? DateTime.fromJSDate(run.expectedDeliveryDate, { zone }).toISODate()
          : null,
        sentCount: run.sentCount,
        lastSentAt: run.lastSentAt?.toISOString() ?? null,
        nextNudgeAt: run.nextNudgeAt?.toISOString() ?? null,
        postponedCount: run.postponedCount,
        postponedUntil: run.postponedUntil?.toISOString() ?? null,
        submittedAt: run.submittedAt?.toISOString() ?? null,
        submittedBy: run.submittedByUser?.name ?? null,
        lines: run.lines.map((l) => ({
          item: l.itemNameSnapshot,
          quantity: l.quantitySnapshot,
          unit: l.unitSnapshot,
        })),
      });
    }

    for (let d = start; d <= end; d = d.plus({ days: 1 })) {
      for (const rule of rules) {
        const rec = rule.recurrence as unknown as Recurrence;
        if (!recurrenceMatchesDate(rec, d)) continue;
        const date = d.toISODate() ?? "";
        if (runKeys.has(`${rule.id}:${date}`)) continue;
        const lines: OrderOccurrenceLine[] = rule.lines.map((l) => ({
          item: l.item.name,
          quantity: l.defaultQuantity,
          unit: l.unit ?? l.item.unit,
        }));
        out.push({
          date,
          orderRuleId: rule.id,
          supplier: rule.supplier.name,
          assignee: rule.assignedUser.name,
          time: rule.reminderTimeOfDay,
          status: "pending",
          cutoffTime: rule.cutoffTime,
          expectedDeliveryDate: null,
          sentCount: 0,
          lastSentAt: null,
          nextNudgeAt: null,
          postponedCount: 0,
          postponedUntil: null,
          submittedAt: null,
          submittedBy: null,
          lines,
        });
      }
    }
    return out.sort((a, b) => a.date.localeCompare(b.date) || a.time.localeCompare(b.time));
  }
}
