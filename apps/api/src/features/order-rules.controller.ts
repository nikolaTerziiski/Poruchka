import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  NotFoundException,
  Param,
  Patch,
  Post,
  UseGuards,
} from "@nestjs/common";
import { Prisma } from "@prisma/client";
import {
  createOrderRuleSchema,
  updateOrderRuleSchema,
  type CreateOrderRuleInput,
  type UpdateOrderRuleInput,
} from "@poruchka/shared";
import { z } from "zod";
import { SupabaseAuthGuard } from "../auth/supabase-auth.guard";
import { TenantId } from "../auth/request-context";
import { ZodValidationPipe } from "../common/zod-validation.pipe";
import { PrismaService } from "../prisma/prisma.service";

const activeSchema = z.object({ active: z.boolean() });

@UseGuards(SupabaseAuthGuard)
@Controller("order-rules")
export class OrderRulesController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  list(@TenantId() tenantId: string) {
    return this.prisma.orderRule.findMany({
      where: { tenantId, archivedAt: null },
      orderBy: { updatedAt: "desc" },
      include: {
        supplier: true,
        assignedUser: true,
        escalationUser: true,
        lines: { include: { item: true }, orderBy: { sortOrder: "asc" } },
      },
    });
  }

  @Post()
  async create(
    @TenantId() tenantId: string,
    @Body(new ZodValidationPipe(createOrderRuleSchema)) dto: CreateOrderRuleInput,
  ) {
    await this.ensureReferences(tenantId, dto);
    return this.prisma.orderRule.create({
      data: {
        tenantId,
        supplierId: dto.supplierId,
        assignedUserId: dto.assignedUserId,
        escalationUserId: dto.escalationUserId ?? null,
        reminderTimeOfDay: dto.reminderTimeOfDay,
        recurrence: dto.recurrence as Prisma.InputJsonValue,
        cutoffTime: dto.cutoffTime ?? null,
        expectedDeliveryOffsetDays: dto.expectedDeliveryOffsetDays ?? null,
        lines: {
          create: dto.lines.map((line, index) => ({
            itemId: line.itemId,
            defaultQuantity: line.defaultQuantity,
            unit: line.unit ?? null,
            notes: line.notes ?? null,
            sortOrder: line.sortOrder ?? index,
          })),
        },
      },
      include: { lines: true },
    });
  }

  @Patch(":id")
  async update(
    @TenantId() tenantId: string,
    @Param("id") id: string,
    @Body(new ZodValidationPipe(updateOrderRuleSchema)) dto: UpdateOrderRuleInput,
  ) {
    await this.ensureOwned(tenantId, id);
    await this.ensureReferences(tenantId, dto);
    return this.prisma.$transaction(async (tx) => {
      await tx.orderRuleLine.deleteMany({ where: { orderRuleId: id } });
      return tx.orderRule.update({
        where: { id },
        data: {
          supplierId: dto.supplierId,
          assignedUserId: dto.assignedUserId,
          escalationUserId: dto.escalationUserId ?? null,
          reminderTimeOfDay: dto.reminderTimeOfDay,
          recurrence: dto.recurrence as Prisma.InputJsonValue,
          cutoffTime: dto.cutoffTime ?? null,
          expectedDeliveryOffsetDays: dto.expectedDeliveryOffsetDays ?? null,
          active: dto.active,
          lines: {
            create: dto.lines.map((line, index) => ({
              itemId: line.itemId,
              defaultQuantity: line.defaultQuantity,
              unit: line.unit ?? null,
              notes: line.notes ?? null,
              sortOrder: line.sortOrder ?? index,
            })),
          },
        },
        include: { lines: true },
      });
    });
  }

  @Patch(":id/active")
  async setActive(
    @TenantId() tenantId: string,
    @Param("id") id: string,
    @Body(new ZodValidationPipe(activeSchema)) dto: { active: boolean },
  ) {
    await this.ensureOwned(tenantId, id);
    return this.prisma.orderRule.update({ where: { id }, data: { active: dto.active } });
  }

  @Delete(":id")
  async archive(@TenantId() tenantId: string, @Param("id") id: string) {
    await this.ensureOwned(tenantId, id);
    await this.prisma.orderRule.update({
      where: { id },
      data: { active: false, archivedAt: new Date() },
    });
    return { ok: true };
  }

  private async ensureOwned(tenantId: string, id: string) {
    const rule = await this.prisma.orderRule.findFirst({ where: { id, tenantId, archivedAt: null } });
    if (!rule) throw new NotFoundException("Order plan not found");
  }

  private async ensureReferences(tenantId: string, dto: CreateOrderRuleInput) {
    const userIds = [dto.assignedUserId, dto.escalationUserId].filter((id): id is string => Boolean(id));
    const [supplier, users, items] = await Promise.all([
      this.prisma.supplier.findFirst({ where: { id: dto.supplierId, tenantId } }),
      this.prisma.user.findMany({ where: { tenantId, id: { in: userIds } }, select: { id: true } }),
      this.prisma.item.findMany({
        where: { tenantId, id: { in: dto.lines.map((line) => line.itemId) } },
        select: { id: true, supplierId: true },
      }),
    ]);
    if (!supplier) throw new BadRequestException("Unknown supplier");
    if (users.length !== new Set(userIds).size) throw new BadRequestException("Unknown team member");
    if (items.length !== dto.lines.length) throw new BadRequestException("Unknown item");
    if (items.some((item) => item.supplierId !== dto.supplierId)) {
      throw new BadRequestException("Every item in an order plan must belong to its supplier");
    }
  }
}
