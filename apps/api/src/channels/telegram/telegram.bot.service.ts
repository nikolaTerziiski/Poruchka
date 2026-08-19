import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { DateTime } from "luxon";
import { Bot, Context, InlineKeyboard } from "grammy";
import { PrismaService } from "../../prisma/prisma.service";
import {
  alreadyDoneToast,
  applyKeypadKey,
  cancelButtonLabel,
  cannotUndoToast,
  confirmButtonLabel,
  confirmedMessage,
  confirmToast,
  linkedMessage,
  notYourOrderToast,
  orderReminderMessage,
  parseQuantityEntry,
  privateChatOnlyMessage,
  quantitiesButtonLabel,
  quantitiesRequiredToast,
  quantityBackButtonLabel,
  quantityDoneButtonLabel,
  quantityEntryMessage,
  quantityFromEntry,
  quantityInvalidToast,
  quantityLineButtonLabel,
  quantityListMessage,
  quantitySavedToast,
  quantitySaveButtonLabel,
  reopenedMessage,
  skipButtonLabel,
  skipConfirmButtonLabel,
  skipConfirmMessage,
  skippedMessage,
  snoozedMessage,
  supplierOrderMessage,
  supplierTextButtonLabel,
  supplierTextReadyToast,
  undoButtonLabel,
} from "../bot-copy";

/** Owns Telegram linking and the one-tap "Sent" order action. */
@Injectable()
export class TelegramBotService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(TelegramBotService.name);
  private polling = false;

  constructor(
    private readonly bot: Bot,
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {}

  async onModuleInit(): Promise<void> {
    this.registerHandlers();
    if (this.config.get<string>("TELEGRAM_POLLING_ENABLED") === "false") {
      this.logger.warn("Telegram polling disabled for this API process");
      return;
    }
    await this.bot.init();
    this.polling = true;
    void this.bot.start({
      onStart: (info) => this.logger.log(`Telegram bot @${info.username} polling for updates`),
    });
  }

  async onModuleDestroy(): Promise<void> {
    if (this.polling) await this.bot.stop();
  }

  private registerHandlers(): void {
    this.bot.command("start", async (ctx) => {
      const code = (typeof ctx.match === "string" ? ctx.match : "").trim();
      // Identity is the individual user, not the chat. Linking in a group would
      // otherwise bind the account to the group id and let every member act as it.
      if (ctx.chat?.type !== "private") {
        await ctx.reply(privateChatOnlyMessage("bg"));
        return;
      }
      const chatId = String(ctx.from?.id ?? ctx.chat?.id);
      if (!code) {
        await ctx.reply("Welcome to Poruchka. Open your personal link from the admin to connect this chat.");
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
        await this.removeButtons(ctx);
        return;
      }
      if (data.startsWith("order:submit:")) {
        await this.submitOrder(data.slice("order:submit:".length), ctx);
        return;
      }
      if (data.startsWith("order:copy:")) {
        await this.copyOrder(data.slice("order:copy:".length), ctx);
        return;
      }
      if (data.startsWith("order:snooze:")) {
        const [, , orderRunId, minutes] = data.split(":");
        await this.snoozeOrder(orderRunId, Number(minutes), ctx);
        return;
      }
      if (data.startsWith("order:skip-confirm:")) {
        await this.skipOrder(data.slice("order:skip-confirm:".length), ctx);
        return;
      }
      if (data.startsWith("order:skip-cancel:")) {
        await ctx.answerCallbackQuery();
        await this.removeButtons(ctx);
        return;
      }
      if (data.startsWith("order:skip:")) {
        await this.requestSkip(data.slice("order:skip:".length), ctx);
        return;
      }
      if (data.startsWith("order:reopen:")) {
        await this.reopenOrder(data.slice("order:reopen:".length), ctx);
        return;
      }
      // Quantity editor: list → per-line keypad → save, all inside one message.
      if (data.startsWith("order:qty:")) {
        await this.showQuantityList(data.slice("order:qty:".length), ctx);
        return;
      }
      if (data.startsWith("order:qline:")) {
        const [, , orderRunId, index] = data.split(":");
        await this.showQuantityPad(orderRunId, Number(index), "", ctx);
        return;
      }
      if (data.startsWith("order:kp:")) {
        const [, , orderRunId, index, key] = data.split(":");
        await this.handleKeypad(orderRunId, Number(index), key, ctx);
        return;
      }
      if (data.startsWith("order:qdone:")) {
        await this.showOrderActions(data.slice("order:qdone:".length), ctx);
        return;
      }
      if (data.startsWith("confirm:")) {
        await ctx.answerCallbackQuery({ text: "This old reminder has expired" });
        await this.removeButtons(ctx);
        return;
      }
      await ctx.answerCallbackQuery();
    });
  }

  private async submitOrder(orderRunId: string, ctx: Context): Promise<void> {
    const result = await this.authorizedRun(orderRunId, ctx);
    if (!result) return;
    const { run, actor } = result;

    if (!["PENDING", "ESCALATED"].includes(run.status)) {
      await ctx.answerCallbackQuery({ text: alreadyDoneToast(run.tenant.language) });
      await this.removeButtons(ctx);
      return;
    }

    if (!run.lines.some((line) => line.quantitySnapshot?.greaterThan(0))) {
      // Don't dead-end: drop the user straight into the quantity editor.
      await this.showQuantityList(run.id, ctx);
      return;
    }

    await this.prisma.orderRun.update({
      where: { id: run.id },
      data: {
        status: "SUBMITTED",
        submittedAt: new Date(),
        submittedByUserId: actor.id,
        nextNudgeAt: null,
        postponedUntil: null,
      },
    });
    await ctx.answerCallbackQuery({ text: confirmToast(run.tenant.language) });
    await this.removeButtons(ctx);
    try {
      // Offer a one-tap undo for a mis-tap — the confirmation is the moment people
      // realise they hit the wrong button.
      await ctx.reply(confirmedMessage(run.tenant.language), {
        reply_markup: new InlineKeyboard().text(
          undoButtonLabel(run.tenant.language),
          `order:reopen:${run.id}`,
        ),
      });
    } catch {
      // The state transition succeeded even if Telegram cannot post a follow-up.
    }
  }

  private async copyOrder(orderRunId: string, ctx: Context): Promise<void> {
    const result = await this.authorizedRun(orderRunId, ctx);
    if (!result) return;
    const { run } = result;
    const lines = run.lines.filter((line) => line.quantitySnapshot?.greaterThan(0));
    if (!lines.length) {
      // Nothing to copy yet — offer the editor rather than a bare refusal.
      await this.showQuantityList(run.id, ctx);
      return;
    }
    await ctx.answerCallbackQuery({ text: supplierTextReadyToast(run.tenant.language) });
    await ctx.reply(
      supplierOrderMessage(run.tenant.language, {
        restaurant: run.tenant.name,
        lines: lines.map((line) => ({
          item: line.itemNameSnapshot,
          quantity: line.quantitySnapshot!.toString(),
          unit: line.unitSnapshot,
          note: line.notesSnapshot,
        })),
      }),
    );
  }

  private async snoozeOrder(orderRunId: string, minutes: number, ctx: Context): Promise<void> {
    const result = await this.authorizedRun(orderRunId, ctx);
    if (!result) return;
    const { run } = result;
    if (!["PENDING", "ESCALATED"].includes(run.status)) {
      await ctx.answerCallbackQuery({ text: alreadyDoneToast(run.tenant.language) });
      await this.removeButtons(ctx);
      return;
    }
    if (![30, 60, 120].includes(minutes)) {
      await ctx.answerCallbackQuery();
      return;
    }
    const now = new Date();
    const until = DateTime.now().setZone(run.tenant.timezone).plus({ minutes }).toJSDate();
    await this.prisma.orderRun.update({
      where: { id: run.id },
      data: {
        // Keep sentCount so snoozing can't reset (and thus defeat) escalation.
        status: "PENDING",
        sentCount: run.sentCount,
        nextNudgeAt: until,
        postponedUntil: until,
        lastPostponedAt: now,
        postponedCount: { increment: 1 },
      },
    });
    const localTime = DateTime.fromJSDate(until).setZone(run.tenant.timezone).toFormat("HH:mm");
    await ctx.answerCallbackQuery();
    await this.removeButtons(ctx);
    await ctx.reply(snoozedMessage(run.tenant.language, localTime));
  }

  private async requestSkip(orderRunId: string, ctx: Context): Promise<void> {
    const result = await this.authorizedRun(orderRunId, ctx);
    if (!result) return;
    const { run } = result;
    if (!["PENDING", "ESCALATED"].includes(run.status)) {
      await ctx.answerCallbackQuery({ text: alreadyDoneToast(run.tenant.language) });
      await this.removeButtons(ctx);
      return;
    }
    const recurrenceType = this.recurrenceType(run.orderRule.recurrence);
    const keyboard = new InlineKeyboard()
      .text(skipConfirmButtonLabel(run.tenant.language), `order:skip-confirm:${run.id}`)
      .row()
      .text(cancelButtonLabel(run.tenant.language), `order:skip-cancel:${run.id}`);
    await ctx.answerCallbackQuery();
    await ctx.reply(skipConfirmMessage(run.tenant.language, recurrenceType), {
      reply_markup: keyboard,
    });
  }

  private async skipOrder(orderRunId: string, ctx: Context): Promise<void> {
    const result = await this.authorizedRun(orderRunId, ctx);
    if (!result) return;
    const { run } = result;
    if (!["PENDING", "ESCALATED"].includes(run.status)) {
      await ctx.answerCallbackQuery({ text: alreadyDoneToast(run.tenant.language) });
      await this.removeButtons(ctx);
      return;
    }
    await this.prisma.orderRun.update({
      where: { id: run.id },
      data: {
        status: "SKIPPED",
        nextNudgeAt: null,
        postponedUntil: null,
        skipReason: "Skipped from Telegram",
      },
    });
    const recurrenceType = this.recurrenceType(run.orderRule.recurrence);
    await ctx.answerCallbackQuery();
    await this.removeButtons(ctx);
    await ctx.reply(skippedMessage(run.tenant.language, recurrenceType), {
      reply_markup: new InlineKeyboard().text(
        undoButtonLabel(run.tenant.language),
        `order:reopen:${run.id}`,
      ),
    });
  }

  private async reopenOrder(orderRunId: string, ctx: Context): Promise<void> {
    const result = await this.authorizedRun(orderRunId, ctx);
    if (!result) return;
    const { run } = result;
    if (run.status !== "SUBMITTED" && run.status !== "SKIPPED") {
      await ctx.answerCallbackQuery({ text: cannotUndoToast(run.tenant.language) });
      await this.removeButtons(ctx);
      return;
    }
    await this.prisma.orderRun.update({
      where: { id: run.id },
      data: {
        status: "PENDING",
        submittedAt: null,
        submittedByUserId: null,
        skipReason: null,
        postponedUntil: null,
        nextNudgeAt: new Date(),
      },
    });
    await ctx.answerCallbackQuery();
    await this.removeButtons(ctx);
    await ctx.reply(reopenedMessage(run.tenant.language));
  }

  /* ── Quantity editor ──────────────────────────────────────────────────────
   * Everything lives in one message that gets edited in place. The in-progress
   * keypad entry is rendered into the message text and read back on the next tap,
   * so there is no server-side session to lose on restart. Lines are addressed by
   * their index in a deterministic sort (sortOrder, then id) because sortOrder is
   * not unique.                                                                */

  private sortedLines<T extends { sortOrder: number; id: string }>(lines: T[]): T[] {
    return [...lines].sort((a, b) => a.sortOrder - b.sortOrder || a.id.localeCompare(b.id));
  }

  /** Guarded fetch shared by every editor step. */
  private async editableRun(orderRunId: string, ctx: Context) {
    const result = await this.authorizedRun(orderRunId, ctx);
    if (!result) return null;
    if (!["PENDING", "ESCALATED"].includes(result.run.status)) {
      await ctx.answerCallbackQuery({ text: alreadyDoneToast(result.run.tenant.language) });
      await this.removeButtons(ctx);
      return null;
    }
    return result;
  }

  private async showQuantityList(orderRunId: string, ctx: Context): Promise<void> {
    const result = await this.editableRun(orderRunId, ctx);
    if (!result) return;
    const { run } = result;
    const lang = run.tenant.language;
    const lines = this.sortedLines(run.lines);

    const keyboard = new InlineKeyboard();
    lines.forEach((line, index) => {
      keyboard
        .text(
          quantityLineButtonLabel(
            line.itemNameSnapshot,
            line.quantitySnapshot?.toString() ?? null,
            line.unitSnapshot,
          ),
          `order:qline:${run.id}:${index}`,
        )
        .row();
    });
    keyboard.text(quantityDoneButtonLabel(lang), `order:qdone:${run.id}`);

    await ctx.answerCallbackQuery();
    await this.editInPlace(
      ctx,
      quantityListMessage(lang, {
        supplier: run.supplier?.name ?? "",
        lines: lines.map((line) => ({
          item: line.itemNameSnapshot,
          quantity: line.quantitySnapshot?.toString() ?? null,
          unit: line.unitSnapshot,
        })),
      }),
      keyboard,
    );
  }

  private async showQuantityPad(
    orderRunId: string,
    index: number,
    entry: string,
    ctx: Context,
    toast?: string,
  ): Promise<void> {
    const result = await this.editableRun(orderRunId, ctx);
    if (!result) return;
    const { run } = result;
    const lang = run.tenant.language;
    const line = this.sortedLines(run.lines)[index];
    if (!line) {
      await ctx.answerCallbackQuery();
      return;
    }

    const k = (key: string) => `order:kp:${run.id}:${index}:${key}`;
    const keyboard = new InlineKeyboard()
      .text("1", k("1")).text("2", k("2")).text("3", k("3")).row()
      .text("4", k("4")).text("5", k("5")).text("6", k("6")).row()
      .text("7", k("7")).text("8", k("8")).text("9", k("9")).row()
      .text(".", k(".")).text("0", k("0")).text("⌫", k("b")).row()
      .text(quantitySaveButtonLabel(lang), k("s"))
      .text(quantityBackButtonLabel(lang), `order:qty:${run.id}`);

    await ctx.answerCallbackQuery(toast ? { text: toast } : undefined);
    await this.editInPlace(
      ctx,
      quantityEntryMessage(lang, {
        item: line.itemNameSnapshot,
        unit: line.unitSnapshot,
        current: line.quantitySnapshot?.toString() ?? null,
        entry,
      }),
      keyboard,
    );
  }

  private async handleKeypad(
    orderRunId: string,
    index: number,
    key: string,
    ctx: Context,
  ): Promise<void> {
    const current = parseQuantityEntry(
      (ctx.callbackQuery?.message as { text?: string } | undefined)?.text,
    );

    if (key !== "s") {
      await this.showQuantityPad(orderRunId, index, applyKeypadKey(current, key), ctx);
      return;
    }

    // Save
    const result = await this.editableRun(orderRunId, ctx);
    if (!result) return;
    const { run } = result;
    const line = this.sortedLines(run.lines)[index];
    if (!line) {
      await ctx.answerCallbackQuery();
      return;
    }
    const quantity = quantityFromEntry(current);
    if (quantity === null) {
      await ctx.answerCallbackQuery({ text: quantityInvalidToast(run.tenant.language) });
      return;
    }
    await this.prisma.orderRunLine.update({
      where: { id: line.id },
      data: { quantitySnapshot: quantity },
    });
    this.logger.log(`Order ${run.id}: ${line.itemNameSnapshot} quantity set to ${quantity} from Telegram`);
    // Straight back to the list so several lines can be filled in one sitting.
    await this.showQuantityList(run.id, ctx);
  }

  /** Restores the normal reminder action buttons after editing. */
  private async showOrderActions(orderRunId: string, ctx: Context): Promise<void> {
    const result = await this.editableRun(orderRunId, ctx);
    if (!result) return;
    const { run } = result;
    const lang = run.tenant.language;
    const lines = this.sortedLines(run.lines);
    const recurrenceType = this.recurrenceType(run.orderRule.recurrence);

    const keyboard = new InlineKeyboard()
      .text(supplierTextButtonLabel(lang), `order:copy:${run.id}`)
      .row()
      .text(quantitiesButtonLabel(lang), `order:qty:${run.id}`)
      .row()
      .text(confirmButtonLabel(lang), `order:submit:${run.id}`)
      .row()
      .text(skipButtonLabel(lang, recurrenceType), `order:skip:${run.id}`);

    await ctx.answerCallbackQuery();
    await this.editInPlace(
      ctx,
      orderReminderMessage(lang, {
        supplier: run.supplier?.name ?? "",
        cutoffTime: run.orderRule.cutoffTime,
        lines: lines.map((line) => ({
          item: line.itemNameSnapshot,
          quantity: line.quantitySnapshot?.toString() ?? null,
          unit: line.unitSnapshot,
          note: line.notesSnapshot,
        })),
      }),
      keyboard,
    );
  }

  private async editInPlace(ctx: Context, text: string, keyboard: InlineKeyboard): Promise<void> {
    try {
      await ctx.editMessageText(text, { reply_markup: keyboard });
    } catch {
      // Telegram rejects a no-op edit and very old messages; fall back to a reply.
      try {
        await ctx.reply(text, { reply_markup: keyboard });
      } catch {
        /* nothing more we can do */
      }
    }
  }

  private async authorizedRun(orderRunId: string, ctx: Context) {
    // Resolve by the individual presser (from.id), not the chat, so a button tap in
    // a shared chat can't act as whoever happens to be linked to that chat.
    const chatId = String(ctx.from?.id ?? ctx.chat?.id);
    const run = await this.prisma.orderRun.findUnique({
      where: { id: orderRunId },
      include: { tenant: true, lines: true, orderRule: true, supplier: true },
    });
    if (!run) {
      await ctx.answerCallbackQuery();
      return null;
    }
    const actor = await this.prisma.user.findFirst({
      where: { tenantId: run.tenantId, chatUserId: chatId, chatChannel: "TELEGRAM" },
    });
    const authorized =
      actor &&
      (actor.id === run.assignedUserId ||
        actor.id === run.orderRule.escalationUserId ||
        actor.role === "OWNER");
    if (!actor || !authorized) {
      await ctx.answerCallbackQuery({ text: notYourOrderToast(run.tenant.language) });
      return null;
    }
    return { run, actor };
  }

  private recurrenceType(recurrence: unknown): string | undefined {
    if (!recurrence || typeof recurrence !== "object" || !("type" in recurrence)) return undefined;
    const value = (recurrence as { type?: unknown }).type;
    return typeof value === "string" ? value : undefined;
  }

  private async removeButtons(ctx: Context): Promise<void> {
    try {
      await ctx.editMessageReplyMarkup();
    } catch {
      // Message may be too old to edit.
    }
  }
}
