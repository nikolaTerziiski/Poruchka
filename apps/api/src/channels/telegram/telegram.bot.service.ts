import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { Bot, Context } from "grammy";
import { PrismaService } from "../../prisma/prisma.service";
import {
  alreadyDoneToast,
  chatAlreadyLinkedMessage,
  confirmedMessage,
  confirmToast,
  invalidLinkMessage,
  linkedMessage,
  skippedToast,
  startWithoutCodeMessage,
  testConfirmedToast,
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
  private polling = false;

  constructor(
    private readonly bot: Bot,
    private readonly prisma: PrismaService,
    private readonly orderActions: TelegramOrderActionService,
    private readonly config: ConfigService,
  ) {}

  async onModuleInit(): Promise<void> {
    this.registerHandlers();
    // Telegram rejects concurrent getUpdates for one token, so only one API
    // instance may poll. Every other instance runs with
    // TELEGRAM_POLLING_ENABLED=false and still serves HTTP (see docs/DEPLOY.md).
    if (this.config.get<string>("TELEGRAM_POLLING_ENABLED") === "false") {
      this.logger.warn("Telegram polling disabled for this API process");
      return;
    }
    await this.bot.init();
    this.polling = true;
    // Long polling; not awaited so Nest finishes bootstrapping.
    void this.bot.start({
      onStart: (info) =>
        this.logger.log(`Telegram bot @${info.username} polling for updates`),
    });
  }

  async onModuleDestroy(): Promise<void> {
    // Stopping a bot that never started throws; only stop what we started.
    if (this.polling) await this.bot.stop();
  }

  private registerHandlers(): void {
    this.bot.command("start", async (ctx) => {
      const code = (typeof ctx.match === "string" ? ctx.match : "").trim();
      if (!code) {
        // No code means no tenant yet, so there is no language to look up;
        // the copy helper falls back to Bulgarian.
        await ctx.reply(startWithoutCodeMessage());
        return;
      }
      // Identity is the person, not the chat: telegramUserId() prefers ctx.from,
      // so linking from a group binds the account to the individual who tapped
      // rather than to the group id (which would let every member act as them).
      // It also makes linking and Done/Postpone authorization compare the same id.
      const chatId = this.telegramUserId(ctx);
      if (!chatId) return;
      const user = await this.prisma.user.findUnique({
        where: { linkCode: code },
        include: { tenant: true },
      });
      if (!user) {
        await ctx.reply(invalidLinkMessage());
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
        // A test tap carries no run id, so the language comes from the tapper's
        // own tenant — same lookup-then-fall-back-to-bg shape as openSnoozeMenu.
        await ctx.answerCallbackQuery({ text: testConfirmedToast(await this.tapperLanguage(ctx)) });
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

  /**
   * Tenant language of whoever tapped, for copy that has no OrderRun to read it
   * from. Undefined on any miss — every caller's copy helper defaults to bg.
   */
  private async tapperLanguage(ctx: Context): Promise<string | undefined> {
    const chatUserId = this.telegramUserId(ctx);
    if (!chatUserId) return undefined;
    const user = await this.prisma.user.findFirst({
      where: { chatChannel: "TELEGRAM", chatUserId },
      select: { tenant: { select: { language: true } } },
    });
    return user?.tenant.language;
  }
}
