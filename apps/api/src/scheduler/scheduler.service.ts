import { Inject, Injectable, Logger } from "@nestjs/common";
import { Cron, CronExpression } from "@nestjs/schedule";
import { DateTime } from "luxon";
import { PrismaService } from "../prisma/prisma.service";
import { NOTIFICATION_CHANNEL, NotificationChannel } from "../channels/notification-channel.port";
import {
  confirmButtonLabel,
  escalationMessage,
  orderReminderMessage,
  quantitiesButtonLabel,
  skipButtonLabel,
  snoozeButtonLabel,
  supplierTextButtonLabel,
} from "../channels/bot-copy";
import { OrderRunsService } from "../features/order-runs.service";

/** Materializes recurring supplier orders, sends nudges, and escalates misses. */
@Injectable()
export class SchedulerService {
  private readonly logger = new Logger(SchedulerService.name);
  private running = false;

  constructor(
    private readonly prisma: PrismaService,
    private readonly orderRuns: OrderRunsService,
    @Inject(NOTIFICATION_CHANNEL) private readonly channel: NotificationChannel,
  ) {}

  @Cron(CronExpression.EVERY_MINUTE)
  async tick(): Promise<void> {
    if (this.running) return;
    this.running = true;
    try {
      await this.orderRuns.materializeToday();
      await this.dispatch();
    } catch (error) {
      this.logger.error(`tick failed: ${error instanceof Error ? error.message : String(error)}`);
    } finally {
      this.running = false;
    }
  }

  private async dispatch(): Promise<void> {
    const now = new Date();
    const due = await this.prisma.orderRun.findMany({
      // ESCALATED runs are re-included so escalation keeps surfacing until the order
      // is actually handled, instead of firing once and going silent forever.
      where: { status: { in: ["PENDING", "ESCALATED"] }, nextNudgeAt: { lte: now } },
      include: {
        tenant: true,
        supplier: true,
        assignedUser: true,
        lines: { orderBy: { sortOrder: "asc" } },
        orderRule: { include: { escalationUser: true } },
      },
    });

    for (const run of due) {
      const nowLocal = DateTime.now().setZone(run.tenant.timezone);

      if (this.inQuietHours(nowLocal.hour, run.tenant.quietHoursStart, run.tenant.quietHoursEnd)) {
        // Guard the defer on the current status + due time so we don't clobber a
        // user action (Sent/Snooze/Skip) that raced this tick.
        await this.prisma.orderRun.updateMany({
          where: { id: run.id, status: run.status, nextNudgeAt: { lte: now } },
          data: { nextNudgeAt: this.nextAllowed(nowLocal, run.tenant.quietHoursEnd).toJSDate() },
        });
        continue;
      }

      const wasEscalated = run.status === "ESCALATED";
      const sentCount = run.sentCount + 1;
      // An unlinked assignee still counts toward escalation — otherwise a never-linked
      // staff member means the order re-nudges forever and no one is ever alerted.
      const escalated = wasEscalated || sentCount >= run.tenant.maxNudges;
      const nextNudgeAt = nowLocal.plus({ minutes: run.tenant.renudgeIntervalMin }).toJSDate();

      // ATOMIC CLAIM: advance the row BEFORE sending, conditional on it still being
      // in the same state and still due. If the user tapped Sent/Snooze in the
      // meantime, status/nextNudgeAt no longer match and the claim affects 0 rows —
      // so we never resurrect a completed order or discard a snooze (the old
      // read-send-then-unconditional-write pattern did exactly that).
      const claim = await this.prisma.orderRun.updateMany({
        where: { id: run.id, status: run.status, nextNudgeAt: { lte: now } },
        data: {
          sentCount,
          lastSentAt: now,
          postponedUntil: null,
          status: escalated ? "ESCALATED" : "PENDING",
          nextNudgeAt,
        },
      });
      if (claim.count === 0) continue;

      // Deliver the assignee reminder while the order is still theirs to place.
      if (!wasEscalated && run.assignedUser.chatUserId) {
        try {
          await this.channel.send({
            chatUserId: run.assignedUser.chatUserId,
            text: orderReminderMessage(run.tenant.language, {
              supplier: run.supplier.name,
              cutoffTime: run.orderRule.cutoffTime,
              lines: run.lines.map((line) => ({
                item: line.itemNameSnapshot,
                quantity: line.quantitySnapshot?.toString() ?? null,
                unit: line.unitSnapshot,
                note: line.notesSnapshot,
              })),
            }),
            buttons: this.orderButtons(
              run.id,
              run.tenant.language,
              this.recurrenceType(run.orderRule.recurrence),
            ),
          });
        } catch (error) {
          // Row is already advanced, so a failed send retries at the next interval
          // rather than immediately — no duplicate blast.
          this.logger.error(`send failed for order ${run.id}: ${error instanceof Error ? error.message : String(error)}`);
        }
      } else if (!wasEscalated && !run.assignedUser.chatUserId) {
        this.logger.warn(`Order ${run.id}: assignee has no linked chat — escalation will cover it`);
      }

      if (escalated) await this.notifyEscalation(run);
      this.logger.log(
        `Order ${run.id} (${run.supplier.name}) for ${run.assignedUser.name}${
          escalated ? " — escalated" : ` (nudge ${sentCount}/${run.tenant.maxNudges})`
        }`,
      );
    }
  }

  private async notifyEscalation(run: {
    id: string;
    tenantId: string;
    dueAt: Date;
    tenant: { language: string; timezone: string };
    supplier: { name: string };
    assignedUser: { name: string };
    orderRule: { escalationUser: { chatUserId: string | null } | null };
  }) {
    const fallbackOwner = run.orderRule.escalationUser
      ? null
      : await this.prisma.user.findFirst({
          where: { tenantId: run.tenantId, role: "OWNER", chatUserId: { not: null } },
        });
    const chatUserId = run.orderRule.escalationUser?.chatUserId ?? fallbackOwner?.chatUserId;
    if (!chatUserId) {
      this.logger.warn(`Order ${run.id}: escalated but no escalation recipient is linked`);
      return;
    }
    try {
      await this.channel.send({
        chatUserId,
        text: escalationMessage(run.tenant.language, {
          supplier: run.supplier.name,
          assignee: run.assignedUser.name,
          dueTime: DateTime.fromJSDate(run.dueAt).setZone(run.tenant.timezone).toFormat("HH:mm"),
        }),
        buttons: this.orderButtons(
          run.id,
          run.tenant.language,
          this.recurrenceType(
            (run.orderRule as { recurrence?: unknown }).recurrence,
          ),
        ),
      });
    } catch (error) {
      this.logger.error(`escalation send failed for order ${run.id}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  private inQuietHours(hour: number, start: number, end: number): boolean {
    if (start === end) return false;
    return start < end ? hour >= start && hour < end : hour >= start || hour < end;
  }

  private orderButtons(orderRunId: string, lang: string, recurrenceType?: string) {
    return [
      {
        label: supplierTextButtonLabel(lang),
        payload: `order:copy:${orderRunId}`,
      },
      {
        // Lets the assignee set amounts from the chat — without this the reminder
        // dead-ends whenever the plan has no default quantities.
        label: quantitiesButtonLabel(lang),
        payload: `order:qty:${orderRunId}`,
      },
      {
        label: confirmButtonLabel(lang),
        payload: `order:submit:${orderRunId}`,
      },
      {
        label: snoozeButtonLabel(lang),
        payload: `order:snooze:${orderRunId}:60`,
      },
      {
        label: skipButtonLabel(lang, recurrenceType),
        payload: `order:skip:${orderRunId}`,
      },
    ];
  }

  private recurrenceType(recurrence: unknown): string | undefined {
    if (!recurrence || typeof recurrence !== "object" || !("type" in recurrence)) return undefined;
    const value = (recurrence as { type?: unknown }).type;
    return typeof value === "string" ? value : undefined;
  }

  private nextAllowed(now: DateTime, quietEnd: number): DateTime {
    let next = now.set({ hour: quietEnd, minute: 0, second: 0, millisecond: 0 });
    if (next <= now) next = next.plus({ days: 1 });
    return next;
  }
}
