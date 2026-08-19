import { Injectable } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { DateTime } from "luxon";
import type { Role } from "../../auth/roles.decorator";
import type { SnoozeChoice } from "../bot-copy";
import { PrismaService } from "../../prisma/prisma.service";

export type OrderActionResult =
  | { outcome: "submitted"; language: string }
  | { outcome: "already_submitted"; language: string }
  | { outcome: "skipped"; language: string }
  | { outcome: "postponed"; language: string; choice: SnoozeChoice }
  | { outcome: "not_found" }
  | { outcome: "unauthorized"; language?: string };

type RunWithContext = Prisma.OrderRunGetPayload<{
  include: {
    tenant: { select: { language: true; timezone: true } };
    orderRule: { select: { escalationUserId: true } };
  };
}>;

type Actor = { id: string; tenantId: string; role: Role };

/**
 * Telegram order action policy (Done / Postpone):
 * - The Telegram identity must map to a Poruchka user in the order's tenant.
 * - The assigned user (or the rule's escalation target) may act on it.
 * - OWNER and MANAGER users in the same tenant may act as an operational override.
 * - Only live orders (PENDING/ESCALATED) can be submitted or postponed; SUBMITTED
 *   and SKIPPED runs are terminal.
 */
@Injectable()
export class TelegramOrderActionService {
  constructor(private readonly prisma: PrismaService) {}

  /** Mark the order as placed (the "Done" button). */
  async submit(orderRunId: string, telegramUserId: string | undefined): Promise<OrderActionResult> {
    const resolved = await this.resolve(orderRunId, telegramUserId);
    if ("outcome" in resolved) return resolved;
    const { run, actor } = resolved;
    const lang = run.tenant.language;

    const terminal = this.terminalOutcome(run.status, lang);
    if (terminal) return terminal;

    const updated = await this.prisma.orderRun.updateMany({
      where: { id: run.id, tenantId: actor.tenantId, status: { in: ["PENDING", "ESCALATED"] } },
      data: {
        status: "SUBMITTED",
        submittedAt: new Date(),
        submittedByUserId: actor.id,
        nextNudgeAt: null,
      },
    });
    return updated.count === 1
      ? { outcome: "submitted", language: lang }
      : { outcome: "already_submitted", language: lang };
  }

  /** Snooze the order to a later time (the "Postpone" button), recording it. */
  async postpone(
    orderRunId: string,
    telegramUserId: string | undefined,
    choice: SnoozeChoice,
  ): Promise<OrderActionResult> {
    const resolved = await this.resolve(orderRunId, telegramUserId);
    if ("outcome" in resolved) return resolved;
    const { run, actor } = resolved;
    const lang = run.tenant.language;

    const terminal = this.terminalOutcome(run.status, lang);
    if (terminal) return terminal;

    const now = new Date();
    const nextAt = this.snoozeTarget(choice, run.tenant.timezone, run.dueAt);
    const updated = await this.prisma.orderRun.updateMany({
      where: { id: run.id, tenantId: actor.tenantId, status: { in: ["PENDING", "ESCALATED"] } },
      data: {
        // Re-arm the nudge cycle from the chosen time.
        status: "PENDING",
        sentCount: 0,
        nextNudgeAt: nextAt,
        postponedUntil: nextAt,
        lastPostponedAt: now,
        postponedCount: { increment: 1 },
      },
    });
    return updated.count === 1
      ? { outcome: "postponed", language: lang, choice }
      : { outcome: "already_submitted", language: lang };
  }

  /** Terminal statuses can't be acted on; map them to an outcome. */
  private terminalOutcome(
    status: RunWithContext["status"],
    lang: string,
  ): OrderActionResult | null {
    if (status === "SUBMITTED") return { outcome: "already_submitted", language: lang };
    if (status === "SKIPPED") return { outcome: "skipped", language: lang };
    return null;
  }

  private snoozeTarget(choice: SnoozeChoice, timezone: string, dueAt: Date): Date {
    const now = DateTime.now().setZone(timezone);
    switch (choice) {
      case "1h":
        return now.plus({ hours: 1 }).toJSDate();
      case "tonight": {
        const tonight = now.set({ hour: 19, minute: 0, second: 0, millisecond: 0 });
        return (tonight <= now ? now.plus({ hours: 1 }) : tonight).toJSDate();
      }
      case "tomorrow": {
        const dueLocal = DateTime.fromJSDate(dueAt).setZone(timezone);
        return now
          .plus({ days: 1 })
          .set({ hour: dueLocal.hour, minute: dueLocal.minute, second: 0, millisecond: 0 })
          .toJSDate();
      }
    }
  }

  private async resolve(
    orderRunId: string,
    telegramUserId: string | undefined,
  ): Promise<{ run: RunWithContext; actor: Actor } | OrderActionResult> {
    if (!telegramUserId) return { outcome: "unauthorized" };

    const run = await this.prisma.orderRun.findUnique({
      where: { id: orderRunId },
      include: {
        tenant: { select: { language: true, timezone: true } },
        orderRule: { select: { escalationUserId: true } },
      },
    });
    if (!run) return { outcome: "not_found" };

    const actor = await this.prisma.user.findFirst({
      where: { tenantId: run.tenantId, chatChannel: "TELEGRAM", chatUserId: telegramUserId },
      select: { id: true, tenantId: true, role: true },
    });
    if (!actor || actor.tenantId !== run.tenantId) {
      return { outcome: "unauthorized", language: run.tenant.language };
    }
    if (!this.canAct(actor, run.assignedUserId, run.orderRule.escalationUserId)) {
      return { outcome: "unauthorized", language: run.tenant.language };
    }
    return { run, actor };
  }

  private canAct(actor: Actor, assignedUserId: string, escalationUserId: string | null): boolean {
    return (
      actor.id === assignedUserId ||
      actor.id === escalationUserId ||
      actor.role === "OWNER" ||
      actor.role === "MANAGER"
    );
  }
}
