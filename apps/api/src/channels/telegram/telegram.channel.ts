import { Injectable } from "@nestjs/common";
import { Bot, InlineKeyboard } from "grammy";
import {
  NotificationChannel,
  OutboundMessage,
} from "../notification-channel.port";

/** Telegram implementation of the NotificationChannel port (grammY). */
@Injectable()
export class TelegramChannel implements NotificationChannel {
  readonly channel = "telegram" as const;

  constructor(private readonly bot: Bot) {}

  async send(message: OutboundMessage): Promise<void> {
    let keyboard: InlineKeyboard | undefined;
    if (message.buttons?.length) {
      keyboard = new InlineKeyboard();
      // One button per row keeps long supplier names readable.
      for (const b of message.buttons) keyboard.text(b.label, b.payload).row();
    }
    await this.bot.api.sendMessage(Number(message.chatUserId), message.text, {
      reply_markup: keyboard,
    });
  }
}
