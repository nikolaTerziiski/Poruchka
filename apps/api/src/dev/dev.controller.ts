import { Controller, Inject, Param, Post } from "@nestjs/common";
import { randomBytes } from "crypto";
import { Bot } from "grammy";
import { PrismaService } from "../prisma/prisma.service";
import {
  NOTIFICATION_CHANNEL,
  NotificationChannel,
} from "../channels/notification-channel.port";

/**
 * Throwaway endpoints to drive the live pilot test before the web admin exists.
 *  - POST /dev/link/:userId          → issue a one-time Telegram deep link
 *  - POST /dev/test-reminder/:userId → send a sample reminder with a Done button
 */
@Controller("dev")
export class DevController {
  constructor(
    @Inject(NOTIFICATION_CHANNEL) private readonly channel: NotificationChannel,
    private readonly bot: Bot,
    private readonly prisma: PrismaService,
  ) {}

  @Post("link/:userId")
  async link(@Param("userId") userId: string) {
    const code = randomBytes(8).toString("hex");
    await this.prisma.user.update({
      where: { id: userId },
      data: { linkCode: code },
    });
    let username: string | undefined;
    try {
      username = this.bot.botInfo.username;
    } catch {
      username = undefined;
    }
    return {
      code,
      deepLink: username
        ? `https://t.me/${username}?start=${code}`
        : `(bot not initialized yet) /start ${code}`,
    };
  }

  @Post("test-reminder/:userId")
  async testReminder(@Param("userId") userId: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user?.chatUserId) {
      return { error: "user not linked yet — POST /dev/link first and open the deep link" };
    }
    await this.channel.send({
      chatUserId: user.chatUserId,
      text: "🛒 Poruchka test: order Pork Meat from Metro today. Tap Done when ordered.",
      buttons: [{ label: "✅ Done", payload: "confirm:test" }],
    });
    return { sent: true, to: user.name };
  }
}
