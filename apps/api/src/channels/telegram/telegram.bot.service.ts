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
  chatAlreadyLinkedMessage,
  confirmedMessage,
  confirmToast,
  linkedMessage,
  skippedToast,
  snoozedToast,
  snoozeOptionLabel,
  SNOOZE_CHOICES,
  type SnoozeChoice,
} from "../bot-copy";
import { TelegramOrderActionService } from "./telegram-order-action.service";

/**
 * Owns the grammY Bot: starts long polling (no public webhook needed for the
 * pilot) and handles two inbound events:
 *  - /start <code>  → link this Telegram chat to a Poruchka user
 *  - callback_query → Done / Postpone taps on an order reminder
 */
@Injectable()
export class TelegramBotService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(TelegramBotService.name);

  constructor(
    private readonly bot: Bot,
    private readonly prisma: PrismaService,
    private readonly orderActions: TelegramOrderActionService,
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
      // A Telegram identity must map to at most one member per tenant, or
      // order authorization and audit attribution become ambiguous.
      const alreadyLinked = await this.prisma.user.findFirst({
        where: {
          tenantId: user.tenantId,
          chatChannel: "TELEGRAM",
          chatUserId: chatId,
          id: { not: user.id },
        },
        select: { id: true },
      });
      if (alreadyLinked) {
        await ctx.reply(chatAlreadyLinkedMessage(user.tenant.language));
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
      if (data === "order:test" || data === "confirm:test") {
        await ctx.answerCallbackQuery({ text: "Test confirmed ✓" });
        try {
          await ctx.editMessageReplyMarkup();
        } catch {
          /* message may be too old to edit */
        }
        return;
      }

      const [ns, action, runId, choice] = data.split(":");
      if (ns === "order" && runId) {
        if (action === "done") {
          await this.handleDone(runId, ctx);
          return;
        }
        if (action === "snooze") {
          if (choice) await this.handleSnooze(runId, choice as SnoozeChoice, ctx);
          else await this.openSnoozeMenu(runId, ctx);
          return;
        }
      }
      await ctx.answerCallbackQuery();
    });
  }

  /** "Done" tap → submit the order. */
  private async handleDone(runId: string, ctx: Context): Promise<void> {
    const result = await this.orderActions.submit(runId, this.telegramUserId(ctx));
    if (result.outcome === "not_found" || result.outcome === "unauthorized") {
      await ctx.answerCallbackQuery();
      return;
    }
    if (result.outcome === "already_submitted") {
      await ctx.answerCallbackQuery({ text: alreadyDoneToast(result.language) });
      return;
    }
    if (result.outcome === "skipped") {
      await ctx.answerCallbackQuery({ text: skippedToast(result.language) });
      await this.clearButtons(ctx);
      return;
    }
    await ctx.answerCallbackQuery({ text: confirmToast(result.language) });
    await this.clearButtons(ctx);
    try {
      await ctx.reply(confirmedMessage(result.language));
    } catch {
      /* ignore */
    }
  }

  /** "Postpone" tap → swap the keyboard for the snooze choices. */
  private async openSnoozeMenu(runId: string, ctx: Context): Promise<void> {
    const run = await this.prisma.orderRun.findUnique({
      where: { id: runId },
      select: { tenant: { select: { language: true } } },
    });
    const lang = run?.tenant.language ?? "bg";
    const row = SNOOZE_CHOICES.map((c) => ({
      text: snoozeOptionLabel(lang, c),
      callback_data: `order:snooze:${runId}:${c}`,
    }));
    try {
      await ctx.editMessageReplyMarkup({ reply_markup: { inline_keyboard: [row] } });
    } catch {
      /* message may be too old to edit */
    }
    await ctx.answerCallbackQuery();
  }

  /** A snooze choice tap → postpone the order. */
  private async handleSnooze(runId: string, choice: SnoozeChoice, ctx: Context): Promise<void> {
    const result = await this.orderActions.postpone(runId, this.telegramUserId(ctx), choice);
    if (result.outcome === "not_found" || result.outcome === "unauthorized") {
      await ctx.answerCallbackQuery();
      return;
    }
    if (result.outcome === "already_submitted") {
      await ctx.answerCallbackQuery({ text: alreadyDoneToast(result.language) });
      await this.clearButtons(ctx);
      return;
    }
    if (result.outcome === "skipped") {
      await ctx.answerCallbackQuery({ text: skippedToast(result.language) });
      await this.clearButtons(ctx);
      return;
    }
    await ctx.answerCallbackQuery({ text: snoozedToast(result.language, choice) });
    await this.clearButtons(ctx);
  }

  private async clearButtons(ctx: Context): Promise<void> {
    try {
      await ctx.editMessageReplyMarkup();
    } catch {
      /* message may be too old to edit */
    }
  }

  private telegramUserId(ctx: Context): string | undefined {
    if (ctx.from?.id !== undefined) return String(ctx.from.id);
    if (ctx.chat?.id !== undefined) return String(ctx.chat.id);
    return undefined;
  }
}
