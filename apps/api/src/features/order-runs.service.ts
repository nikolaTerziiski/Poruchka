import { BadRequestException, Injectable } from "@nestjs/common";
import { DateTime } from "luxon";
import type { Recurrence } from "@poruchka/shared";
import { PrismaService } from "../prisma/prisma.service";
import { recurrenceMatchesDate } from "../reminders/recurrence";

@Injectable()
export class OrderRunsService {
  constructor(private readonly prisma: PrismaService) {}

  async materializeToday(): Promise<void> {
    const tenants = await this.prisma.tenant.findMany({
      select: { id: true, timezone: true },
    });
    for (const tenant of tenants) {
      const today = DateTime.now().setZone(tenant.timezone).startOf("day");
      // Backfill the last few days too: if the process was down/asleep overnight,
      // those due dates were never materialized and the reminders would be lost
      // permanently (not just delayed). This recovers short outages on the next tick.
      await this.materializeRange(tenant.id, today.minus({ days: 3 }), today);
    }
  }

  async materializeRange(tenantId: string, start: DateTime, end: DateTime): Promise<void> {
    if (end < start || end.diff(start, "days").days > 62) {
      throw new BadRequestException("Order range must be between 1 and 63 days");
    }

    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
      include: {
        orderRules: {
          where: { active: true, archivedAt: null },
          include: { lines: { include: { item: true }, orderBy: { sortOrder: "asc" } } },
        },
      },
    });
    if (!tenant) return;

    for (let day = start.setZone(tenant.timezone).startOf("day"); day <= end; day = day.plus({ days: 1 })) {
      for (const rule of tenant.orderRules) {
        if (!recurrenceMatchesDate(rule.recurrence as unknown as Recurrence, day)) continue;

        const [hour, minute] = rule.reminderTimeOfDay.split(":").map(Number);
        const dueAt = day.set({ hour, minute, second: 0, millisecond: 0 });
        const dueDate = this.utcDateOf(day);
        const expectedDeliveryDate =
          rule.expectedDeliveryOffsetDays === null
            ? null
            : this.utcDateOf(day.plus({ days: rule.expectedDeliveryOffsetDays }));

        const previous = await this.prisma.orderRun.findFirst({
          where: {
            tenantId,
            orderRuleId: rule.id,
            dueDate: { lt: dueDate },
            status: { in: ["SUBMITTED", "CONFIRMED", "PARTIALLY_RECEIVED", "RECEIVED"] },
          },
          orderBy: { dueDate: "desc" },
          include: { lines: true },
        });
        const previousQuantity = new Map(previous?.lines.map((line) => [line.itemId, line.quantitySnapshot]) ?? []);

        await this.prisma.$transaction(async (tx) => {
          const run = await tx.orderRun.upsert({
            where: { orderRuleId_dueDate: { orderRuleId: rule.id, dueDate } },
            update: {},
            create: {
              tenantId,
              orderRuleId: rule.id,
              supplierId: rule.supplierId,
              assignedUserId: rule.assignedUserId,
              dueDate,
              dueAt: dueAt.toJSDate(),
              expectedDeliveryDate,
              nextNudgeAt: dueAt.toJSDate(),
            },
          });

          await tx.orderRunLine.createMany({
            data: rule.lines.map((line) => ({
              orderRunId: run.id,
              itemId: line.itemId,
              itemNameSnapshot: line.item.name,
              quantitySnapshot: previousQuantity.get(line.itemId) ?? line.defaultQuantity,
              unitSnapshot: line.unit ?? line.item.unit,
              notesSnapshot: line.notes ?? line.item.notes,
              sortOrder: line.sortOrder,
            })),
            skipDuplicates: true,
          });
        });
      }
    }
  }

  private utcDateOf(date: DateTime): Date {
    return new Date(Date.UTC(date.year, date.month - 1, date.day));
  }
}
