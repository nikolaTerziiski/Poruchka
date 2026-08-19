import { Controller, Get, Query, UseGuards } from "@nestjs/common";
import { DateTime } from "luxon";
import { SupabaseAuthGuard } from "../auth/supabase-auth.guard";
import { TenantId } from "../auth/request-context";
import { PrismaService } from "../prisma/prisma.service";
import { OrderRunsService } from "./order-runs.service";

/**
 * Calendar read-model over supplier order runs. Listing materializes missing
 * occurrences first so the calendar and reminder engine share one source of truth.
 */
@UseGuards(SupabaseAuthGuard)
@Controller("reminders")
export class RemindersController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly orderRuns: OrderRunsService,
  ) {}

  @Get()
  async list(@TenantId() tenantId: string, @Query("from") from?: string, @Query("to") to?: string) {
    const tenant = await this.prisma.tenant.findUnique({ where: { id: tenantId } });
    const zone = tenant?.timezone || "Europe/Sofia";

    const start = (from ? DateTime.fromISO(from, { zone }) : DateTime.now().setZone(zone).startOf("week")).startOf("day");
    const end = (to ? DateTime.fromISO(to, { zone }) : start.plus({ days: 6 })).startOf("day");

    await this.orderRuns.materializeRange(tenantId, start, end);
    const runs = await this.prisma.orderRun.findMany({
      where: {
        tenantId,
        dueDate: {
          gte: new Date(Date.UTC(start.year, start.month - 1, start.day)),
          lte: new Date(Date.UTC(end.year, end.month - 1, end.day)),
        },
      },
      include: {
        supplier: true,
        assignedUser: true,
        lines: { orderBy: { sortOrder: "asc" } },
      },
    });

    const out: Array<{
      date: string;
      orderRunId: string;
      item: string;
      supplier: string;
      assignee: string;
      time: string;
      status: string;
    }> = [];

    for (const run of runs) {
      const status =
        run.status === "PENDING"
          ? "pending"
          : run.status === "ESCALATED"
            ? "escalated"
            : run.status === "SKIPPED"
              ? "skipped"
              : "confirmed";
      for (const line of run.lines) {
        out.push({
          date: DateTime.fromJSDate(run.dueDate, { zone: "utc" }).toISODate() ?? "",
          orderRunId: run.id,
          item: line.itemNameSnapshot,
          supplier: run.supplier.name,
          assignee: run.assignedUser.name,
          time: DateTime.fromJSDate(run.dueAt).setZone(zone).toFormat("HH:mm"),
          status,
        });
      }
    }
    return out;
  }
}
