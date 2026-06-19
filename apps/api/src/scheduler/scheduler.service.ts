import { Inject, Injectable, Logger } from "@nestjs/common";
import { Cron, CronExpression } from "@nestjs/schedule";
import { DateTime } from "luxon";
import type { Recurrence } from "@poruchka/shared";
import { PrismaService } from "../prisma/prisma.service";
import { NOTIFICATION_CHANNEL, NotificationChannel } from "../channels/notification-channel.port";
import { recurrenceMatchesDate } from "../reminders/recurrence";

/**
 * The reminder engine. Each tick:
 *  1. materialize — create today's PENDING reminder instances for active
 *     schedules whose recurrence matches today (idempotent via the
 *     scheduleId+dueDate unique constraint).
 *  2. dispatch — send/re-nudge due PENDING reminders to the responsible
 *     person's chat, honoring quiet hours and the nudge cap (then escalate).
 * Confirmation (a tapped "Done") is handled in TelegramBotService.
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
      include: { schedules: { where: { active: true } } },
    });
    for (const tenant of tenants) {
      const today = DateTime.now().setZone(tenant.timezone).startOf("day");
      for (const s of tenant.schedules) {
        const rec = s.recurrence as unknown as Recurrence;
        if (!recurrenceMatchesDate(rec, today)) continue;
        const [hh, mm] = s.reminderTimeOfDay.split(":").map((n) => parseInt(n, 10));
        const dueAt = today.set({ hour: hh, minute: mm, second: 0, millisecond: 0 });
        await this.prisma.reminderInstance.upsert({
          where: { scheduleId_dueDate: { scheduleId: s.id, dueDate: this.utcDateOf(today) } },
          update: {},
          create: {
            tenantId: tenant.id,
            scheduleId: s.id,
            dueDate: this.utcDateOf(today),
            status: "PENDING",
            nextNudgeAt: dueAt.toJSDate(),
          },
        });
      }
    }
  }

  private async dispatch(): Promise<void> {
    const now = new Date();
    const due = await this.prisma.reminderInstance.findMany({
      where: { status: "PENDING", nextNudgeAt: { lte: now } },
      include: {
        tenant: true,
        schedule: { include: { item: { include: { supplier: true } }, assignedUser: true } },
      },
    });

    for (const r of due) {
      const t = r.tenant;
      const nowLocal = DateTime.now().setZone(t.timezone);

      // Quiet hours → defer to the next allowed time, don't send.
      if (this.inQuietHours(nowLocal.hour, t.quietHoursStart, t.quietHoursEnd)) {
        await this.prisma.reminderInstance.update({
          where: { id: r.id },
          data: { nextNudgeAt: this.nextAllowed(nowLocal, t.quietHoursEnd).toJSDate() },
        });
        continue;
      }

      const user = r.schedule.assignedUser;
      if (!user.chatUserId) {
        this.logger.warn(`Reminder ${r.id}: assignee has no linked chat — deferring`);
        await this.prisma.reminderInstance.update({
          where: { id: r.id },
          data: { nextNudgeAt: nowLocal.plus({ minutes: t.renudgeIntervalMin }).toJSDate() },
        });
        continue;
      }

      const text = `🛒 Order ${r.schedule.item.name} from ${r.schedule.item.supplier.name} today. Tap Done when it's ordered.`;
      try {
        await this.channel.send({
          chatUserId: user.chatUserId,
          text,
          buttons: [{ label: "✅ Done", payload: `confirm:${r.id}` }],
        });
      } catch (e) {
        this.logger.error(`send failed for reminder ${r.id}: ${e instanceof Error ? e.message : String(e)}`);
        continue;
      }

      const sentCount = r.sentCount + 1;
      const escalate = sentCount >= t.maxNudges;
      await this.prisma.reminderInstance.update({
        where: { id: r.id },
        data: {
          sentCount,
          lastSentAt: now,
          status: escalate ? "ESCALATED" : "PENDING",
          nextNudgeAt: escalate ? null : nowLocal.plus({ minutes: t.renudgeIntervalMin }).toJSDate(),
        },
      });
      this.logger.log(
        `Reminder ${r.id} (${r.schedule.item.name}) sent to ${user.name}${escalate ? " — escalated" : ` (nudge ${sentCount}/${t.maxNudges})`}`,
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
