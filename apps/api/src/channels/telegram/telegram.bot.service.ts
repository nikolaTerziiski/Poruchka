import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from "@nestjs/common";
import { Bot, Context } from "grammy";
import { PrismaService } from "../../prisma/prisma.service";

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
      });
      if (!user) {
        await ctx.reply("This link is invalid or has already been used.");
        return;
      }
      await this.prisma.user.update({
        where: { id: user.id },
        data: { chatUserId: chatId, chatChannel: "TELEGRAM", linkCode: null },
      });
      await ctx.reply(
        `✅ Connected, ${user.name}. You'll receive your ordering reminders here.`,
      );
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
    const chatId = String(ctx.chat?.id ?? ctx.from?.id);
    const reminder = await this.prisma.reminderInstance.findUnique({
      where: { id: reminderId },
    });
    if (!reminder || reminder.status === "CONFIRMED") {
      await ctx.answerCallbackQuery({ text: "Already done ✓" });
      return;
    }
    const user = await this.prisma.user.findFirst({
      where: { chatUserId: chatId },
    });
    await this.prisma.reminderInstance.update({
      where: { id: reminderId },
      data: {
        status: "CONFIRMED",
        confirmedAt: new Date(),
        confirmedByUserId: user?.id ?? null,
        nextNudgeAt: null,
      },
    });
    await ctx.answerCallbackQuery({ text: "Marked as ordered ✓" });
    try {
      await ctx.editMessageReplyMarkup();
    } catch {
      /* ignore */
    }
  }
}
