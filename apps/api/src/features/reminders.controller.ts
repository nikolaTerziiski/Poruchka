import { Controller, Get, Query, UseGuards } from "@nestjs/common";
import { DateTime } from "luxon";
import type { Recurrence } from "@poruchka/shared";
import { SupabaseAuthGuard } from "../auth/supabase-auth.guard";
import { TenantId } from "../auth/request-context";
import { PrismaService } from "../prisma/prisma.service";
import { recurrenceMatchesDate } from "../reminders/recurrence";

/**
 * Calendar read-model: derives order occurrences from active schedules across a
 * date range, overlaying real ReminderInstance status where one exists. Lets the
 * calendar populate as soon as a schedule is created (before the scheduler runs).
 */
@UseGuards(SupabaseAuthGuard)
@Controller("reminders")
export class RemindersController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  async list(@TenantId() tenantId: string, @Query("from") from?: string, @Query("to") to?: string) {
    const tenant = await this.prisma.tenant.findUnique({ where: { id: tenantId } });
    const zone = tenant?.timezone || "Europe/Sofia";

    const start = (from ? DateTime.fromISO(from, { zone }) : DateTime.now().setZone(zone).startOf("week")).startOf("day");
    const end = (to ? DateTime.fromISO(to, { zone }) : start.plus({ days: 6 })).startOf("day");

    const [schedules, instances] = await Promise.all([
      this.prisma.schedule.findMany({
        where: { tenantId, active: true },
        include: { item: { include: { supplier: true } }, assignedUser: true },
      }),
      this.prisma.reminderInstance.findMany({
        where: { tenantId, dueDate: { gte: start.toJSDate(), lte: end.endOf("day").toJSDate() } },
      }),
    ]);

    const out: Array<{
      date: string;
      scheduleId: string;
      item: string;
      supplier: string;
      assignee: string;
      time: string;
      status: string;
    }> = [];

    for (let d = start; d <= end; d = d.plus({ days: 1 })) {
      for (const s of schedules) {
        const rec = s.recurrence as unknown as Recurrence;
        if (!recurrenceMatchesDate(rec, d)) continue;
        const inst = instances.find(
          (i) => i.scheduleId === s.id && DateTime.fromJSDate(i.dueDate, { zone }).hasSame(d, "day"),
        );
        out.push({
          date: d.toISODate() ?? "",
          scheduleId: s.id,
          item: s.item.name,
          supplier: s.item.supplier.name,
          assignee: s.assignedUser.name,
          time: s.reminderTimeOfDay,
          status: inst ? inst.status.toLowerCase() : "pending",
        });
      }
    }
    return out;
  }
}
