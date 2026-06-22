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
  expectedDeliveryDate: string | null;
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
        where: { tenantId, active: true },
        include: {
          supplier: { select: { name: true } },
          assignedUser: { select: { name: true } },
          lines: { include: { item: { select: { name: true, unit: true } } }, orderBy: { sortOrder: "asc" } },
        },
      }),
      this.prisma.orderRun.findMany({
        where: { tenantId, dueDate: { gte: start.toJSDate(), lte: end.endOf("day").toJSDate() } },
        include: { lines: { orderBy: { sortOrder: "asc" } } },
      }),
    ]);

    const out: OrderOccurrence[] = [];

    for (let d = start; d <= end; d = d.plus({ days: 1 })) {
      for (const rule of rules) {
        const rec = rule.recurrence as unknown as Recurrence;
        if (!recurrenceMatchesDate(rec, d)) continue;
        const run = runs.find(
          (r) => r.orderRuleId === rule.id && DateTime.fromJSDate(r.dueDate, { zone }).hasSame(d, "day"),
        );
        const lines: OrderOccurrenceLine[] = run
          ? run.lines.map((l) => ({ item: l.itemNameSnapshot, quantity: l.quantitySnapshot, unit: l.unitSnapshot }))
          : rule.lines.map((l) => ({
              item: l.item.name,
              quantity: l.defaultQuantity,
              unit: l.unit ?? l.item.unit,
            }));
        out.push({
          date: d.toISODate() ?? "",
          orderRuleId: rule.id,
          supplier: rule.supplier.name,
          assignee: rule.assignedUser.name,
          time: rule.reminderTimeOfDay,
          status: run ? run.status.toLowerCase() : "pending",
          expectedDeliveryDate: run?.expectedDeliveryDate
            ? DateTime.fromJSDate(run.expectedDeliveryDate, { zone }).toISODate()
            : null,
          lines,
        });
      }
    }
    return out;
  }
}
