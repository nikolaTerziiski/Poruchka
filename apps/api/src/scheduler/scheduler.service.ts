import { Inject, Injectable, Logger } from "@nestjs/common";
import { Cron, CronExpression } from "@nestjs/schedule";
import { DateTime } from "luxon";
import type { Recurrence } from "@poruchka/shared";
import { PrismaService } from "../prisma/prisma.service";
import { NOTIFICATION_CHANNEL, NotificationChannel } from "../channels/notification-channel.port";
import { doneButtonLabel, orderReminderMessage, postponeButtonLabel } from "../channels/bot-copy";
import { recurrenceMatchesDate } from "../reminders/recurrence";

/**
 * The order engine. Each tick:
 *  1. materialize — create today's PENDING OrderRuns (with snapshotted lines)
 *     for active OrderRules whose recurrence matches today (idempotent via the
 *     orderRuleId+dueDate unique constraint).
 *  2. dispatch — send/re-nudge due PENDING orders to the responsible person's
 *     chat as a single per-supplier order sheet, honoring quiet hours and the
 *     nudge cap (then escalate).
 * Done/Postpone taps are handled in TelegramBotService + TelegramOrderActionService.
 */
@Injectable()
export class SchedulerService {
  private readonly logger = new Logger(SchedulerService.name);
  private running = false;

  constructor(
    private readonly prisma: PrismaService,
    @Inject(NOTIFICATION_CHANNEL) private readonly channel: NotificationChannel,
  ) {}

  @Cron(CronExpression.EVERY_MINUTE)
  async tick(): Promise<void> {
    if (this.running) return; // never overlap two ticks
    this.running = true;
    try {
      await this.materialize();
      await this.dispatch();
    } catch (e) {
      this.logger.error(`tick failed: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      this.running = false;
    }
  }

  /** A @db.Date value pinned to the calendar date (no timezone drift). */
  private utcDateOf(dt: DateTime): Date {
    return new Date(Date.UTC(dt.year, dt.month - 1, dt.day));
  }

  private async materialize(): Promise<void> {
    const tenants = await this.prisma.tenant.findMany({
      include: {
        orderRules: {
          where: { active: true },
          include: { lines: { include: { item: true }, orderBy: { sortOrder: "asc" } } },
        },
      },
    });
    for (const tenant of tenants) {
      const today = DateTime.now().setZone(tenant.timezone).startOf("day");
      for (const rule of tenant.orderRules) {
        if (rule.lines.length === 0) continue; // nothing to order
        const rec = rule.recurrence as unknown as Recurrence;
        if (!recurrenceMatchesDate(rec, today)) continue;

        const dueDate = this.utcDateOf(today);
        const exists = await this.prisma.orderRun.findUnique({
          where: { orderRuleId_dueDate: { orderRuleId: rule.id, dueDate } },
          select: { id: true },
        });
        if (exists) continue;

        const [hh, mm] = rule.reminderTimeOfDay.split(":").map((n) => parseInt(n, 10));
        const dueAt = today.set({ hour: hh, minute: mm, second: 0, millisecond: 0 });
        const expectedDeliveryDate =
          rule.expectedDeliveryOffsetDays != null
            ? this.utcDateOf(today.plus({ days: rule.expectedDeliveryOffsetDays }))
            : null;

        await this.prisma.orderRun.create({
          data: {
            tenantId: tenant.id,
            orderRuleId: rule.id,
            supplierId: rule.supplierId,
            assignedUserId: rule.assignedUserId,
            dueDate,
            dueAt: dueAt.toJSDate(),
            expectedDeliveryDate,
            status: "PENDING",
            nextNudgeAt: dueAt.toJSDate(),
            lines: {
              create: rule.lines.map((l, i) => ({
                itemId: l.itemId,
                itemNameSnapshot: l.item.name,
                quantitySnapshot: l.defaultQuantity ?? null,
                unitSnapshot: l.unit ?? l.item.unit ?? null,
                notesSnapshot: l.notes ?? l.item.notes ?? null,
                sortOrder: l.sortOrder ?? i,
              })),
            },
          },
        });
      }
    }
  }

  private async dispatch(): Promise<void> {
    const now = new Date();
    const due = await this.prisma.orderRun.findMany({
      where: { status: "PENDING", nextNudgeAt: { lte: now } },
      include: {
        tenant: true,
        supplier: true,
        assignedUser: true,
        lines: { orderBy: { sortOrder: "asc" } },
        orderRule: { select: { cutoffTime: true } },
      },
    });

    for (const run of due) {
      const t = run.tenant;
      const nowLocal = DateTime.now().setZone(t.timezone);

      // Quiet hours → defer to the next allowed time, don't send.
      if (this.inQuietHours(nowLocal.hour, t.quietHoursStart, t.quietHoursEnd)) {
        await this.prisma.orderRun.update({
          where: { id: run.id },
          data: { nextNudgeAt: this.nextAllowed(nowLocal, t.quietHoursEnd).toJSDate() },
        });
        continue;
      }

      const user = run.assignedUser;
      if (!user.chatUserId) {
        this.logger.warn(`OrderRun ${run.id}: assignee has no linked chat — deferring`);
        await this.prisma.orderRun.update({
          where: { id: run.id },
          data: { nextNudgeAt: nowLocal.plus({ minutes: t.renudgeIntervalMin }).toJSDate() },
        });
        continue;
      }

      const text = orderReminderMessage(t.language, {
        supplier: run.supplier.name,
        cutoffTime: run.orderRule.cutoffTime,
        lines: run.lines.map((l) => ({
          name: l.itemNameSnapshot,
          quantity: l.quantitySnapshot,
          unit: l.unitSnapshot,
          note: l.notesSnapshot,
        })),
      });
      try {
        await this.channel.send({
          chatUserId: user.chatUserId,
          text,
          buttons: [
            { label: doneButtonLabel(t.language), payload: `order:done:${run.id}` },
            { label: postponeButtonLabel(t.language), payload: `order:snooze:${run.id}` },
          ],
        });
      } catch (e) {
        this.logger.error(
          `send failed for order ${run.id}: ${e instanceof Error ? e.message : String(e)}`,
        );
        continue;
      }

      const sentCount = run.sentCount + 1;
      const escalate = sentCount >= t.maxNudges;
      await this.prisma.orderRun.update({
        where: { id: run.id },
        data: {
          sentCount,
          lastSentAt: now,
          status: escalate ? "ESCALATED" : "PENDING",
          nextNudgeAt: escalate ? null : nowLocal.plus({ minutes: t.renudgeIntervalMin }).toJSDate(),
        },
      });
      this.logger.log(
        `OrderRun ${run.id} (${run.supplier.name}, ${run.lines.length} items) sent to ${user.name}${escalate ? " — escalated" : ` (nudge ${sentCount}/${t.maxNudges})`}`,
      );
    }
  }

  private inQuietHours(hour: number, start: number, end: number): boolean {
    if (start === end) return false;
    return start < end ? hour >= start && hour < end : hour >= start || hour < end;
  }

  private nextAllowed(now: DateTime, quietEnd: number): DateTime {
    let next = now.set({ hour: quietEnd, minute: 0, second: 0, millisecond: 0 });
    if (next <= now) next = next.plus({ days: 1 });
    return next;
  }
}
