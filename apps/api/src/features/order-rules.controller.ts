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
import { createOrderRuleSchema, type CreateOrderRuleInput } from "@poruchka/shared";
import { z } from "zod";
import { SupabaseAuthGuard } from "../auth/supabase-auth.guard";
import { TenantId } from "../auth/request-context";
import { Roles } from "../auth/roles.decorator";
import { RolesGuard } from "../auth/roles.guard";
import { ZodValidationPipe } from "../common/zod-validation.pipe";
import { PrismaService } from "../prisma/prisma.service";

const updateOrderRuleSchema = createOrderRuleSchema.partial().extend({
  active: z.boolean().optional(),
});
type UpdateOrderRuleInput = z.infer<typeof updateOrderRuleSchema>;

const RULE_INCLUDE = {
  supplier: true,
  assignedUser: { select: { id: true, name: true } },
  escalationUser: { select: { id: true, name: true } },
  lines: {
    include: { item: { select: { id: true, name: true, unit: true } } },
    orderBy: { sortOrder: "asc" as const },
  },
} satisfies Prisma.OrderRuleInclude;

type RuleLineInput = CreateOrderRuleInput["lines"][number];

function lineCreateData(lines: RuleLineInput[]) {
  return lines.map((l, i) => ({
    itemId: l.itemId,
    defaultQuantity: l.defaultQuantity ?? null,
    unit: l.unit ?? null,
    notes: l.notes ?? null,
    sortOrder: l.sortOrder ?? i,
  }));
}

@UseGuards(SupabaseAuthGuard, RolesGuard)
@Controller("order-rules")
export class OrderRulesController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  list(@TenantId() tenantId: string) {
    return this.prisma.orderRule.findMany({
      where: { tenantId, archivedAt: null },
      orderBy: { createdAt: "desc" },
      include: RULE_INCLUDE,
    });
  }

  @Roles("OWNER", "MANAGER")
  @Post()
  async create(
    @TenantId() tenantId: string,
    @Body(new ZodValidationPipe(createOrderRuleSchema)) dto: CreateOrderRuleInput,
  ) {
    await this.validateRefs(tenantId, {
      supplierId: dto.supplierId,
      assignedUserId: dto.assignedUserId,
      escalationUserId: dto.escalationUserId,
      itemIds: dto.lines.map((l) => l.itemId),
    });
    return this.prisma.orderRule.create({
      data: {
        tenantId,
        supplierId: dto.supplierId,
        assignedUserId: dto.assignedUserId,
        escalationUserId: dto.escalationUserId ?? null,
        reminderTimeOfDay: dto.reminderTimeOfDay,
        recurrence: dto.recurrence as unknown as Prisma.InputJsonValue,
        cutoffTime: dto.cutoffTime ?? null,
        expectedDeliveryOffsetDays: dto.expectedDeliveryOffsetDays ?? null,
        lines: { create: lineCreateData(dto.lines) },
      },
      include: RULE_INCLUDE,
    });
  }

  @Roles("OWNER", "MANAGER")
  @Patch(":id")
  async update(
    @TenantId() tenantId: string,
    @Param("id") id: string,
    @Body(new ZodValidationPipe(updateOrderRuleSchema)) dto: UpdateOrderRuleInput,
  ) {
    const existing = await this.prisma.orderRule.findFirst({
      where: { id, tenantId, archivedAt: null },
      select: { id: true, supplierId: true },
    });
    if (!existing) throw new NotFoundException("Order rule not found");

    const supplierId = dto.supplierId ?? existing.supplierId;
    if (dto.supplierId && dto.supplierId !== existing.supplierId && !dto.lines) {
      throw new BadRequestException("Changing supplier requires replacing order lines");
    }
    await this.validateRefs(tenantId, {
      supplierId: dto.supplierId,
      assignedUserId: dto.assignedUserId,
      escalationUserId: dto.escalationUserId,
      itemIds: dto.lines?.map((l) => l.itemId),
      supplierForItems: supplierId,
    });

    const data: Prisma.OrderRuleUpdateInput = {};
    if (dto.supplierId) data.supplier = { connect: { id: dto.supplierId } };
    if (dto.assignedUserId) data.assignedUser = { connect: { id: dto.assignedUserId } };
    if (dto.escalationUserId !== undefined) {
      data.escalationUser = dto.escalationUserId
        ? { connect: { id: dto.escalationUserId } }
        : { disconnect: true };
    }
    if (dto.reminderTimeOfDay !== undefined) data.reminderTimeOfDay = dto.reminderTimeOfDay;
    if (dto.recurrence !== undefined) {
      data.recurrence = dto.recurrence as unknown as Prisma.InputJsonValue;
    }
    if (dto.cutoffTime !== undefined) data.cutoffTime = dto.cutoffTime ?? null;
    if (dto.expectedDeliveryOffsetDays !== undefined) {
      data.expectedDeliveryOffsetDays = dto.expectedDeliveryOffsetDays ?? null;
    }
    if (dto.active !== undefined) data.active = dto.active;
    if (dto.lines) {
      // Replace the whole basket atomically.
      data.lines = { deleteMany: {}, create: lineCreateData(dto.lines) };
    }

    return this.prisma.orderRule.update({ where: { id }, data, include: RULE_INCLUDE });
  }

  @Roles("OWNER", "MANAGER")
  @Delete(":id")
  async remove(@TenantId() tenantId: string, @Param("id") id: string) {
    const existing = await this.prisma.orderRule.findFirst({
      where: { id, tenantId, archivedAt: null },
      select: { id: true },
    });
    if (!existing) throw new NotFoundException("Order rule not found");
    await this.prisma.orderRule.update({
      where: { id },
      data: { active: false, archivedAt: new Date() },
    });
    return { ok: true };
  }

  /** Every referenced supplier/user/item must belong to the tenant, and every
   *  line item must belong to the order's supplier. */
  private async validateRefs(
    tenantId: string,
    refs: {
      supplierId?: string;
      assignedUserId?: string;
      escalationUserId?: string | null;
      itemIds?: string[];
      supplierForItems?: string;
    },
  ): Promise<void> {
    if (refs.supplierId) {
      const s = await this.prisma.supplier.findFirst({
        where: { id: refs.supplierId, tenantId },
        select: { id: true },
      });
      if (!s) throw new BadRequestException("Unknown supplier");
    }
    if (refs.assignedUserId) {
      const u = await this.prisma.user.findFirst({
        where: { id: refs.assignedUserId, tenantId },
        select: { id: true },
      });
      if (!u) throw new BadRequestException("Unknown assignee");
    }
    if (refs.escalationUserId) {
      const u = await this.prisma.user.findFirst({
        where: { id: refs.escalationUserId, tenantId },
        select: { id: true },
      });
      if (!u) throw new BadRequestException("Unknown escalation user");
    }
    if (refs.itemIds && refs.itemIds.length) {
      const ids = [...new Set(refs.itemIds)];
      const items = await this.prisma.item.findMany({
        where: { id: { in: ids }, tenantId },
        select: { id: true, supplierId: true },
      });
      if (items.length !== ids.length) throw new BadRequestException("Unknown item in order lines");
      const supplierForItems = refs.supplierForItems ?? refs.supplierId;
      if (supplierForItems && items.some((it) => it.supplierId !== supplierForItems)) {
        throw new BadRequestException("All order items must belong to the order's supplier");
      }
    }
  }
}
