import { Injectable } from "@nestjs/common";
import type { Role } from "../../auth/roles.decorator";
import { PrismaService } from "../../prisma/prisma.service";

export type TelegramReminderConfirmationResult =
  | { outcome: "confirmed"; language: string }
  | { outcome: "already_confirmed"; language: string }
  | { outcome: "not_found" }
  | { outcome: "unauthorized"; language?: string };

/**
 * Telegram confirmation policy:
 * - The Telegram identity must map to a Poruchka user in the reminder tenant.
 * - The assigned user may confirm their own reminder.
 * - OWNER and MANAGER users in the same tenant may confirm as an operational override.
 * - Other STAFF users and users from other tenants are rejected.
 */
@Injectable()
export class TelegramReminderConfirmationService {
  constructor(private readonly prisma: PrismaService) {}

  async confirm(
    reminderId: string,
    telegramUserId: string | undefined,
  ): Promise<TelegramReminderConfirmationResult> {
    if (!telegramUserId) return { outcome: "unauthorized" };

    const reminder = await this.prisma.reminderInstance.findUnique({
      where: { id: reminderId },
      include: {
        tenant: true,
        schedule: { select: { assignedUserId: true } },
      },
    });
    if (!reminder) return { outcome: "not_found" };

    const actor = await this.prisma.user.findFirst({
      where: {
        tenantId: reminder.tenantId,
        chatChannel: "TELEGRAM",
        chatUserId: telegramUserId,
      },
      select: { id: true, tenantId: true, role: true },
    });
    if (!actor || actor.tenantId !== reminder.tenantId) {
      return { outcome: "unauthorized", language: reminder.tenant.language };
    }

    if (!this.canConfirm(actor, reminder.schedule.assignedUserId)) {
      return { outcome: "unauthorized", language: reminder.tenant.language };
    }

    if (reminder.status === "CONFIRMED") {
      return { outcome: "already_confirmed", language: reminder.tenant.language };
    }

    const updated = await this.prisma.reminderInstance.updateMany({
      where: {
        id: reminder.id,
        tenantId: actor.tenantId,
        status: { not: "CONFIRMED" },
      },
      data: {
        status: "CONFIRMED",
        confirmedAt: new Date(),
        confirmedByUserId: actor.id,
        nextNudgeAt: null,
      },
    });

    return updated.count === 1
      ? { outcome: "confirmed", language: reminder.tenant.language }
      : { outcome: "already_confirmed", language: reminder.tenant.language };
  }

  private canConfirm(actor: { id: string; role: Role }, assignedUserId: string): boolean {
    return actor.id === assignedUserId || actor.role === "OWNER" || actor.role === "MANAGER";
  }
}
