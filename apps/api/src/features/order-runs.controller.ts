import {
  BadRequestException,
  Body,
  ConflictException,
  Controller,
  Get,
  NotFoundException,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from "@nestjs/common";
import { DateTime } from "luxon";
import {
  confirmOrderRunSchema,
  receiveOrderRunSchema,
  skipOrderRunSchema,
  snoozeOrderRunSchema,
  updateOrderRunDraftSchema,
  type ConfirmOrderRunInput,
  type ReceiveOrderRunInput,
  type SkipOrderRunInput,
  type SnoozeOrderRunInput,
  type UpdateOrderRunDraftInput,
} from "@poruchka/shared";
import { supplierOrderMessage } from "../channels/bot-copy";
import { CurrentUser, TenantId } from "../auth/request-context";
import { SupabaseAuthGuard } from "../auth/supabase-auth.guard";
import { ZodValidationPipe } from "../common/zod-validation.pipe";
import { PrismaService } from "../prisma/prisma.service";
import { OrderRunsService } from "./order-runs.service";

const OPEN_STATUSES = ["PENDING", "ESCALATED"] as const;
const RECEIVABLE_STATUSES = ["SUBMITTED", "CONFIRMED", "PARTIALLY_RECEIVED"] as const;

@UseGuards(SupabaseAuthGuard)
@Controller("order-runs")
export class OrderRunsController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly orderRuns: OrderRunsService,
  ) {}

  @Get()
  async list(@TenantId() tenantId: string, @Query("from") from?: string, @Query("to") to?: string) {
    const tenant = await this.prisma.tenant.findUnique({ where: { id: tenantId } });
    if (!tenant) throw new NotFoundException("Restaurant not found");

    const start = (from ? DateTime.fromISO(from, { zone: tenant.timezone }) : DateTime.now().setZone(tenant.timezone).startOf("week")).startOf("day");
    const end = (to ? DateTime.fromISO(to, { zone: tenant.timezone }) : start.plus({ days: 6 })).startOf("day");
    if (!start.isValid || !end.isValid) throw new BadRequestException("Dates must be ISO calendar dates");
    await this.orderRuns.materializeRange(tenantId, start, end);

    const runs = await this.prisma.orderRun.findMany({
      where: { tenantId, dueDate: { gte: this.utcDateOf(start), lte: this.utcDateOf(end) } },
      orderBy: [{ dueDate: "asc" }, { dueAt: "asc" }],
      include: {
        supplier: true,
        assignedUser: true,
        submittedByUser: true,
        orderRule: { select: { cutoffTime: true, recurrence: true } },
        lines: { include: { item: true }, orderBy: { sortOrder: "asc" } },
      },
    });

    const itemIds = [...new Set(runs.flatMap((run) => run.lines.map((line) => line.itemId)))];
    const history = itemIds.length
      ? await this.prisma.orderRunLine.findMany({
          where: {
            itemId: { in: itemIds },
            unitPrice: { not: null },
            orderRun: { tenantId, status: { in: ["PARTIALLY_RECEIVED", "RECEIVED"] } },
          },
          include: { orderRun: { select: { dueDate: true } } },
          orderBy: { orderRun: { dueDate: "desc" } },
          take: 500,
        })
      : [];

    return runs.map((run) => ({
      ...run,
      lines: run.lines.map((line) => {
        const previous = history.find(
          (candidate) => candidate.itemId === line.itemId && candidate.orderRun.dueDate < run.dueDate,
        );
        const current = line.unitPrice?.toNumber() ?? null;
        const previousPrice = previous?.unitPrice?.toNumber() ?? null;
        return {
          ...line,
          previousUnitPrice: previousPrice,
          priceChangePercent:
            current !== null && previousPrice
              ? Math.round(((current - previousPrice) / previousPrice) * 1000) / 10
              : null,
        };
      }),
    }));
  }

  @Patch(":id/draft")
  async updateDraft(
    @TenantId() tenantId: string,
    @Param("id") id: string,
    @Body(new ZodValidationPipe(updateOrderRunDraftSchema)) dto: UpdateOrderRunDraftInput,
  ) {
    const run = await this.getOwned(tenantId, id);
    if (!OPEN_STATUSES.includes(run.status as (typeof OPEN_STATUSES)[number])) {
      throw new ConflictException("Only open orders can be edited");
    }
    const lineIds = new Set(run.lines.map((line) => line.id));
    if (new Set(dto.lines.map((line) => line.lineId)).size !== dto.lines.length) {
      throw new BadRequestException("Order lines must be unique");
    }
    if (dto.lines.some((line) => !lineIds.has(line.lineId))) {
      throw new BadRequestException("Unknown order line");
    }
    await this.prisma.$transaction(
      dto.lines.map((line) =>
        this.prisma.orderRunLine.update({
          where: { id: line.lineId },
          data: { quantitySnapshot: line.quantity },
        }),
      ),
    );
    return this.getOwned(tenantId, id);
  }

  @Post(":id/submit")
  async submit(
    @TenantId() tenantId: string,
    @CurrentUser() user: { id: string },
    @Param("id") id: string,
  ) {
    const run = await this.getOwned(tenantId, id);
    if (!OPEN_STATUSES.includes(run.status as (typeof OPEN_STATUSES)[number])) {
      if (run.status === "SUBMITTED") return run;
      throw new ConflictException("This order is no longer open");
    }
    if (!run.lines.some((line) => line.quantitySnapshot && line.quantitySnapshot.greaterThan(0))) {
      throw new BadRequestException("Enter at least one quantity before marking the order as sent");
    }
    return this.prisma.orderRun.update({
      where: { id },
      data: {
        status: "SUBMITTED",
        submittedAt: new Date(),
        submittedByUserId: user.id,
        nextNudgeAt: null,
        postponedUntil: null,
      },
      include: { lines: true, supplier: true, assignedUser: true },
    });
  }

  @Get(":id/supplier-message")
  async supplierMessage(@TenantId() tenantId: string, @Param("id") id: string) {
    const run = await this.getOwned(tenantId, id);
    const lines = run.lines.filter((line) => line.quantitySnapshot?.greaterThan(0));
    if (!lines.length) {
      throw new BadRequestException("Enter at least one quantity before copying the order");
    }
    return {
      text: supplierOrderMessage(run.tenant.language, {
        restaurant: run.tenant.name,
        lines: lines.map((line) => ({
          item: line.itemNameSnapshot,
          quantity: line.quantitySnapshot!.toString(),
          unit: line.unitSnapshot,
          note: line.notesSnapshot,
        })),
      }),
    };
  }

  @Post(":id/snooze")
  async snooze(
    @TenantId() tenantId: string,
    @Param("id") id: string,
    @Body(new ZodValidationPipe(snoozeOrderRunSchema)) dto: SnoozeOrderRunInput,
  ) {
    const run = await this.getOwned(tenantId, id);
    if (!OPEN_STATUSES.includes(run.status as (typeof OPEN_STATUSES)[number])) {
      throw new ConflictException("Only an open order can be snoozed");
    }
    const now = new Date();
    const until = DateTime.now()
      .setZone(run.tenant.timezone)
      .plus({ minutes: dto.minutes })
      .toJSDate();
    return this.prisma.orderRun.update({
      where: { id },
      data: {
        // Keep sentCount — snoozing must NOT reset the escalation counter, or an
        // escalated order could be snoozed indefinitely and never re-escalate.
        status: "PENDING",
        sentCount: run.sentCount,
        nextNudgeAt: until,
        postponedUntil: until,
        lastPostponedAt: now,
        postponedCount: { increment: 1 },
      },
      include: { lines: true, supplier: true, assignedUser: true, orderRule: true },
    });
  }

  @Post(":id/skip")
  async skip(
    @TenantId() tenantId: string,
    @Param("id") id: string,
    @Body(new ZodValidationPipe(skipOrderRunSchema)) dto: SkipOrderRunInput,
  ) {
    const run = await this.getOwned(tenantId, id);
    if (!OPEN_STATUSES.includes(run.status as (typeof OPEN_STATUSES)[number])) {
      if (run.status === "SKIPPED") return run;
      throw new ConflictException("Only an open order can be skipped");
    }
    return this.prisma.orderRun.update({
      where: { id },
      data: {
        status: "SKIPPED",
        nextNudgeAt: null,
        postponedUntil: null,
        skipReason: dto.reason || "Skipped by user",
      },
      include: { lines: true, supplier: true, assignedUser: true, orderRule: true },
    });
  }

  @Post(":id/reopen")
  async reopen(@TenantId() tenantId: string, @Param("id") id: string) {
    const run = await this.getOwned(tenantId, id);
    if (run.status !== "SUBMITTED" && run.status !== "SKIPPED") {
      throw new ConflictException("Only a sent or skipped order can be reopened");
    }
    // Undo an accidental Sent/Skip: put the order back in play so it re-enters the
    // nudge loop. sentCount is left as-is, so a truly-overdue order re-escalates.
    return this.prisma.orderRun.update({
      where: { id },
      data: {
        status: "PENDING",
        submittedAt: null,
        submittedByUserId: null,
        skipReason: null,
        postponedUntil: null,
        nextNudgeAt: new Date(),
      },
      include: { lines: true, supplier: true, assignedUser: true, orderRule: true },
    });
  }

  @Post(":id/confirm")
  async confirm(
    @TenantId() tenantId: string,
    @Param("id") id: string,
    @Body(new ZodValidationPipe(confirmOrderRunSchema)) dto: ConfirmOrderRunInput,
  ) {
    const run = await this.getOwned(tenantId, id);
    if (run.status !== "SUBMITTED" && run.status !== "CONFIRMED") {
      throw new ConflictException("Only a sent order can be confirmed by the supplier");
    }
    return this.prisma.orderRun.update({
      where: { id },
      data: {
        status: "CONFIRMED",
        supplierConfirmedAt: run.supplierConfirmedAt ?? new Date(),
        supplierReference: dto.supplierReference ?? run.supplierReference,
        expectedDeliveryDate: dto.expectedDeliveryDate
          ? this.utcDateOf(DateTime.fromISO(dto.expectedDeliveryDate, { zone: "utc" }))
          : run.expectedDeliveryDate,
      },
      include: { lines: true, supplier: true, assignedUser: true },
    });
  }

  @Post(":id/receive")
  async receive(
    @TenantId() tenantId: string,
    @Param("id") id: string,
    @Body(new ZodValidationPipe(receiveOrderRunSchema)) dto: ReceiveOrderRunInput,
  ) {
    const run = await this.getOwned(tenantId, id);
    if (!RECEIVABLE_STATUSES.includes(run.status as (typeof RECEIVABLE_STATUSES)[number])) {
      throw new ConflictException("This order cannot be received in its current state");
    }
    const provided = new Map(dto.lines.map((line) => [line.lineId, line]));
    if (provided.size !== dto.lines.length || dto.lines.some((line) => !run.lines.some((known) => known.id === line.lineId))) {
      throw new BadRequestException("Unknown or duplicate order line");
    }
    for (const line of dto.lines) {
      const ordered = run.lines.find((known) => known.id === line.lineId)?.quantitySnapshot?.toNumber();
      if (
        ordered !== undefined &&
        line.receivedQuantity !== null &&
        line.receivedQuantity < ordered &&
        !line.exceptionType
      ) {
        throw new BadRequestException("Short or missing quantities require an exception type");
      }
    }

    const reconciled = run.lines
      .filter((line) => line.quantitySnapshot?.greaterThan(0))
      .every((line) => {
        const next = provided.get(line.id);
        const receivedQuantity = next ? next.receivedQuantity : line.receivedQuantity?.toNumber() ?? null;
        const exceptionType = next ? next.exceptionType : line.exceptionType;
        return receivedQuantity !== null || Boolean(exceptionType);
      });

    await this.prisma.$transaction([
      ...dto.lines.map((line) =>
        this.prisma.orderRunLine.update({
          where: { id: line.lineId },
          data: {
            receivedQuantity: line.receivedQuantity,
            unitPrice: line.unitPrice,
            exceptionType: line.exceptionType ?? null,
            exceptionNote: line.exceptionNote ?? null,
          },
        }),
      ),
      this.prisma.orderRun.update({
        where: { id },
        data: {
          status: reconciled ? "RECEIVED" : "PARTIALLY_RECEIVED",
          receivedAt: reconciled ? new Date() : null,
          receivingNote: dto.receivingNote ?? null,
        },
      }),
    ]);
    return this.getOwned(tenantId, id);
  }

  private async getOwned(tenantId: string, id: string) {
    const run = await this.prisma.orderRun.findFirst({
      where: { id, tenantId },
      include: {
        lines: true,
        supplier: true,
        assignedUser: true,
        tenant: true,
        orderRule: true,
      },
    });
    if (!run) throw new NotFoundException("Order not found");
    return run;
  }

  private utcDateOf(date: DateTime): Date {
    return new Date(Date.UTC(date.year, date.month - 1, date.day));
  }
}
