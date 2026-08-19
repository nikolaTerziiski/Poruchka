import { TelegramBotService } from "./telegram.bot.service";

/**
 * Drives the real callback router end-to-end with a fake grammY bot + Prisma.
 * Covers the quantity editor added to close the "reminder dead-ends on the phone"
 * gap, plus the linking/identity rules.
 */

/** Minimal stand-in for a Prisma Decimal column. */
const dec = (n: number | null) =>
  n === null
    ? null
    : { toString: () => String(n), greaterThan: (x: number) => n > x, toNumber: () => n };

function makeRun(lines: Array<{ id: string; name: string; qty: number | null; sortOrder?: number }>) {
  return {
    id: "run-1",
    tenantId: "tenant-1",
    status: "PENDING",
    assignedUserId: "user-1",
    tenant: { language: "en", name: "Mehana", timezone: "Europe/Sofia" },
    supplier: { name: "Metro" },
    orderRule: { recurrence: { type: "weekly" }, cutoffTime: "11:00", escalationUserId: null },
    lines: lines.map((l, i) => ({
      id: l.id,
      itemNameSnapshot: l.name,
      quantitySnapshot: dec(l.qty),
      unitSnapshot: "kg",
      notesSnapshot: null,
      sortOrder: l.sortOrder ?? i,
    })),
  };
}

function harness(run: ReturnType<typeof makeRun>) {
  const handlers: Record<string, (ctx: unknown) => Promise<void>> = {};
  const bot = {
    command: (name: string, fn: (ctx: unknown) => Promise<void>) => {
      handlers[`command:${name}`] = fn;
    },
    on: (evt: string, fn: (ctx: unknown) => Promise<void>) => {
      handlers[evt] = fn;
    },
    init: jest.fn(),
    start: jest.fn(),
    stop: jest.fn(),
  };
  const prisma = {
    orderRun: { findUnique: jest.fn().mockResolvedValue(run), update: jest.fn().mockResolvedValue({}) },
    orderRunLine: { update: jest.fn().mockResolvedValue({}) },
    user: {
      findFirst: jest.fn().mockResolvedValue({ id: "user-1", role: "STAFF" }),
      findUnique: jest.fn(),
      update: jest.fn().mockResolvedValue({}),
    },
  };
  // Polling disabled so onModuleInit only registers handlers.
  const config = { get: jest.fn().mockReturnValue("false") };
  const service = new TelegramBotService(bot as never, prisma as never, config as never);
  return { service, handlers, prisma, bot };
}

function makeCtx(data: string, messageText?: string) {
  return {
    callbackQuery: { data, message: messageText === undefined ? undefined : { text: messageText } },
    chat: { id: 555, type: "private" },
    from: { id: 555 },
    answerCallbackQuery: jest.fn().mockResolvedValue(undefined),
    editMessageText: jest.fn().mockResolvedValue(undefined),
    editMessageReplyMarkup: jest.fn().mockResolvedValue(undefined),
    reply: jest.fn().mockResolvedValue(undefined),
  };
}

/** Flattens an InlineKeyboard's callback_data values. */
const callbackData = (ctx: ReturnType<typeof makeCtx>) => {
  const markup = ctx.editMessageText.mock.calls.at(-1)?.[1]?.reply_markup;
  return (markup?.inline_keyboard ?? []).flat().map((b: { callback_data?: string }) => b.callback_data);
};
const buttonText = (ctx: ReturnType<typeof makeCtx>) => {
  const markup = ctx.editMessageText.mock.calls.at(-1)?.[1]?.reply_markup;
  return (markup?.inline_keyboard ?? []).flat().map((b: { text?: string }) => b.text);
};

describe("TelegramBotService quantity editor", () => {
  it("offers one button per line when Quantities is tapped", async () => {
    const run = makeRun([
      { id: "l1", name: "Pork", qty: 24 },
      { id: "l2", name: "Tomatoes", qty: null },
    ]);
    const { service, handlers } = harness(run);
    await service.onModuleInit();

    const ctx = makeCtx("order:qty:run-1");
    await handlers["callback_query:data"](ctx);

    expect(buttonText(ctx)).toEqual(["Pork: 24 kg", "Tomatoes: —", "Done"]);
    expect(callbackData(ctx)).toContain("order:qline:run-1:0");
    expect(callbackData(ctx)).toContain("order:qline:run-1:1");
    // A line with no quantity is still reachable — this is the first-reminder case.
    expect(ctx.editMessageText.mock.calls.at(-1)?.[0]).toContain("Tomatoes: —");
  });

  it("opens a numeric keypad for the chosen line", async () => {
    const { service, handlers } = harness(makeRun([{ id: "l1", name: "Pork", qty: 24 }]));
    await service.onModuleInit();

    const ctx = makeCtx("order:qline:run-1:0");
    await handlers["callback_query:data"](ctx);

    const data = callbackData(ctx);
    for (const d of ["1", "5", "0", ".", "b", "s"]) {
      expect(data).toContain(`order:kp:run-1:0:${d}`);
    }
    expect(ctx.editMessageText.mock.calls.at(-1)?.[0]).toContain("Currently: 24");
  });

  it("accumulates digits across taps by reading the message back", async () => {
    const { service, handlers } = harness(makeRun([{ id: "l1", name: "Pork", qty: 24 }]));
    await service.onModuleInit();

    // Message currently shows an in-progress "3"; tapping 0 must yield "30".
    const ctx = makeCtx("order:kp:run-1:0:0", "✏️ Pork (kg)\nCurrently: 24\n\n= 3");
    await handlers["callback_query:data"](ctx);

    expect(ctx.editMessageText.mock.calls.at(-1)?.[0]).toContain("= 30");
  });

  it("saves the entered quantity to the right line and returns to the list", async () => {
    const run = makeRun([
      { id: "l1", name: "Pork", qty: 24 },
      { id: "l2", name: "Tomatoes", qty: null },
    ]);
    const { service, handlers, prisma } = harness(run);
    await service.onModuleInit();

    const ctx = makeCtx("order:kp:run-1:1:s", "✏️ Tomatoes (kg)\nCurrently: —\n\n= 12.5");
    await handlers["callback_query:data"](ctx);

    expect(prisma.orderRunLine.update).toHaveBeenCalledWith({
      where: { id: "l2" },
      data: { quantitySnapshot: 12.5 },
    });
    // Back on the list, ready for the next line.
    expect(buttonText(ctx)).toContain("Done");
  });

  it("refuses an unusable entry instead of writing it", async () => {
    const { service, handlers, prisma } = harness(makeRun([{ id: "l1", name: "Pork", qty: null }]));
    await service.onModuleInit();

    const ctx = makeCtx("order:kp:run-1:0:s", "✏️ Pork (kg)\nCurrently: —\n\n= —");
    await handlers["callback_query:data"](ctx);

    expect(prisma.orderRunLine.update).not.toHaveBeenCalled();
    expect(ctx.answerCallbackQuery).toHaveBeenCalledWith({ text: "Invalid quantity" });
  });

  it("addresses lines stably when sortOrder collides", async () => {
    // All sortOrder 0 (the schema default) — index must still map deterministically.
    const run = makeRun([
      { id: "lb", name: "B", qty: null, sortOrder: 0 },
      { id: "la", name: "A", qty: null, sortOrder: 0 },
    ]);
    const { service, handlers, prisma } = harness(run);
    await service.onModuleInit();

    const ctx = makeCtx("order:kp:run-1:0:s", "= 5");
    await handlers["callback_query:data"](ctx);

    // Sorted by (sortOrder, id) → "la" is index 0, regardless of input order.
    expect(prisma.orderRunLine.update).toHaveBeenCalledWith({
      where: { id: "la" },
      data: { quantitySnapshot: 5 },
    });
  });

  it("opens the editor instead of dead-ending when Sent is tapped with no quantities", async () => {
    const run = makeRun([{ id: "l1", name: "Pork", qty: null }]);
    const { service, handlers, prisma } = harness(run);
    await service.onModuleInit();

    const ctx = makeCtx("order:submit:run-1");
    await handlers["callback_query:data"](ctx);

    // The old behaviour was a toast saying "add quantities in the app".
    expect(prisma.orderRun.update).not.toHaveBeenCalled();
    expect(buttonText(ctx)).toContain("Pork: —");
  });

  it("still submits normally once a quantity exists", async () => {
    const run = makeRun([{ id: "l1", name: "Pork", qty: 24 }]);
    const { service, handlers, prisma } = harness(run);
    await service.onModuleInit();

    await handlers["callback_query:data"](makeCtx("order:submit:run-1"));

    expect(prisma.orderRun.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: "SUBMITTED" }) }),
    );
  });

  it("blocks editing an order that is no longer open", async () => {
    const run = { ...makeRun([{ id: "l1", name: "Pork", qty: null }]), status: "SUBMITTED" };
    const { service, handlers, prisma } = harness(run as never);
    await service.onModuleInit();

    const ctx = makeCtx("order:kp:run-1:0:s", "= 9");
    await handlers["callback_query:data"](ctx);

    expect(prisma.orderRunLine.update).not.toHaveBeenCalled();
  });

  it("rejects a caller who is not on the order", async () => {
    const run = makeRun([{ id: "l1", name: "Pork", qty: null }]);
    const { service, handlers, prisma } = harness(run);
    // A linked user in the tenant, but not assignee/escalation/owner.
    prisma.user.findFirst.mockResolvedValue({ id: "stranger", role: "STAFF" });
    await service.onModuleInit();

    const ctx = makeCtx("order:kp:run-1:0:s", "= 9");
    await handlers["callback_query:data"](ctx);

    expect(prisma.orderRunLine.update).not.toHaveBeenCalled();
    expect(ctx.answerCallbackQuery).toHaveBeenCalledWith({
      text: "This order is assigned to someone else",
    });
  });
});

describe("TelegramBotService linking", () => {
  it("refuses to link outside a private chat", async () => {
    const { service, handlers, prisma } = harness(makeRun([{ id: "l1", name: "Pork", qty: 1 }]));
    await service.onModuleInit();

    const ctx = {
      ...makeCtx(""),
      match: "somecode",
      chat: { id: -100200, type: "supergroup" },
      from: { id: 555 },
    };
    await handlers["command:start"](ctx);

    // Linking in a group would bind the account to the shared chat id.
    expect(prisma.user.update).not.toHaveBeenCalled();
    expect(ctx.reply).toHaveBeenCalled();
  });

  it("links using the individual user id, not the chat id", async () => {
    const { service, handlers, prisma } = harness(makeRun([{ id: "l1", name: "Pork", qty: 1 }]));
    prisma.user.findUnique.mockResolvedValue({
      id: "user-1",
      name: "Ivan",
      tenant: { language: "en" },
    });
    await service.onModuleInit();

    const ctx = {
      ...makeCtx(""),
      match: "code123",
      chat: { id: 777, type: "private" },
      from: { id: 555 },
    };
    await handlers["command:start"](ctx);

    expect(prisma.user.update).toHaveBeenCalledWith({
      where: { id: "user-1" },
      data: { chatUserId: "555", chatChannel: "TELEGRAM", linkCode: null },
    });
  });
});
