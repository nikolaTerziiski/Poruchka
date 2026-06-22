import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from "@nestjs/common";
import { Bot, Context } from "grammy";
import { PrismaService } from "../../prisma/prisma.service";
import {
  alreadyDoneToast,
  confirmedMessage,
  confirmToast,
  linkedMessage,
} from "../bot-copy";
import { TelegramReminderConfirmationService } from "./telegram-reminder-confirmation.service";

/**
 * Owns the grammY Bot: starts long polling (no public webhook needed for the
 * pilot) and handles two inbound events:
 *  - /start <code>  → link this Telegram chat to a Poruchka user
 *  - callback_query → a tapped "Done" button confirms a reminder
 */
@Injectable()
export class TelegramBotService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(TelegramBotService.name);

  constructor(
    private readonly bot: Bot,
    private readonly prisma: PrismaService,
    private readonly confirmationService: TelegramReminderConfirmationService,
  ) {}

  async onModuleInit(): Promise<void> {
    this.registerHandlers();
    await this.bot.init();
    // Long polling; not awaited so Nest finishes bootstrapping.
    void this.bot.start({
      onStart: (info) =>
        this.logger.log(`Telegram bot @${info.username} polling for updates`),
    });
  }

  async onModuleDestroy(): Promise<void> {
    await this.bot.stop();
  }

  private registerHandlers(): void {
    this.bot.command("start", async (ctx) => {
      const code = (typeof ctx.match === "string" ? ctx.match : "").trim();
      const chatId = String(ctx.chat?.id ?? ctx.from?.id);
      if (!code) {
        await ctx.reply(
          "Welcome to Poruchka. Open your personal link from the admin to connect this chat.",
        );
        return;
      }
      const user = await this.prisma.user.findUnique({
        where: { linkCode: code },
        include: { tenant: true },
      });
      if (!user) {
        await ctx.reply("This link is invalid or has already been used.");
        return;
      }
      await this.prisma.user.update({
        where: { id: user.id },
        data: { chatUserId: chatId, chatChannel: "TELEGRAM", linkCode: null },
      });
      await ctx.reply(linkedMessage(user.tenant.language, user.name));
      this.logger.log(`Linked user ${user.id} to Telegram chat ${chatId}`);
    });

    this.bot.on("callback_query:data", async (ctx) => {
      const data = ctx.callbackQuery.data;
      if (data === "confirm:test") {
        await ctx.answerCallbackQuery({ text: "Test confirmed ✓" });
        try {
          await ctx.editMessageReplyMarkup();
        } catch {
          /* message may be too old to edit */
        }
        return;
      }
      if (data.startsWith("confirm:")) {
        await this.confirmReminder(data.slice("confirm:".length), ctx);
        return;
      }
      await ctx.answerCallbackQuery();
    });
  }

  private async confirmReminder(reminderId: string, ctx: Context): Promise<void> {
    const telegramUserId =
      ctx.from?.id !== undefined ? String(ctx.from.id) : ctx.chat?.id !== undefined ? String(ctx.chat.id) : undefined;
    const result = await this.confirmationService.confirm(reminderId, telegramUserId);
    if (result.outcome === "not_found" || result.outcome === "unauthorized") {
      await ctx.answerCallbackQuery();
      return;
    }
    if (result.outcome === "already_confirmed") {
      await ctx.answerCallbackQuery({ text: alreadyDoneToast(result.language) });
      return;
    }
    await ctx.answerCallbackQuery({ text: confirmToast(result.language) });
    try {
      await ctx.editMessageReplyMarkup();
    } catch {
      /* ignore */
    }
    try {
      await ctx.reply(confirmedMessage(result.language));
    } catch {
      /* ignore */
    }
  }
}
