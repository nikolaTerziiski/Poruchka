import { BadRequestException, Body, Controller, Delete, Get, NotFoundException, Param, Patch, Post, UseGuards } from "@nestjs/common";
import { createScheduleSchema } from "@poruchka/shared";
import { z } from "zod";
import { SupabaseAuthGuard } from "../auth/supabase-auth.guard";
import { TenantId } from "../auth/request-context";
import { Roles } from "../auth/roles.decorator";
import { RolesGuard } from "../auth/roles.guard";
import { ZodValidationPipe } from "../common/zod-validation.pipe";
import { PrismaService } from "../prisma/prisma.service";

const updateScheduleSchema = createScheduleSchema.partial().extend({
  active: z.boolean().optional(),
});

type JsonValue = string | number | boolean | null | JsonObject | JsonValue[];
type JsonObject = { [key: string]: JsonValue };
type JsonInput = JsonObject | JsonValue[];

type ScheduleUpdateData = {
  reminderTimeOfDay?: string;
  active?: boolean;
  recurrence?: JsonInput;
  item?: { connect: { id: string } };
  assignedUser?: { connect: { id: string } };
};

@UseGuards(SupabaseAuthGuard, RolesGuard)
@Controller("schedules")
export class SchedulesController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  list(@TenantId() tenantId: string) {
    return this.prisma.schedule.findMany({
      where: { tenantId },
      orderBy: { createdAt: "desc" },
      include: { item: { include: { supplier: true } }, assignedUser: true },
    });
  }

  @Roles("OWNER", "MANAGER")
  @Post()
  async create(
    @TenantId() tenantId: string,
    @Body(new ZodValidationPipe(createScheduleSchema)) dto: {
      itemId: string;
      assignedUserId: string;
      reminderTimeOfDay: string;
      recurrence: unknown;
    },
  ) {
    await this.ensureItemAndUser(tenantId, dto.itemId, dto.assignedUserId);
    return this.prisma.schedule.create({
      data: {
        tenantId,
        itemId: dto.itemId,
        assignedUserId: dto.assignedUserId,
        reminderTimeOfDay: dto.reminderTimeOfDay,
        recurrence: dto.recurrence as JsonInput,
      },
    });
  }

  @Roles("OWNER", "MANAGER")
  @Patch(":id")
  async update(
    @TenantId() tenantId: string,
    @Param("id") id: string,
    @Body(new ZodValidationPipe(updateScheduleSchema)) dto: {
      itemId?: string;
      assignedUserId?: string;
      reminderTimeOfDay?: string;
      recurrence?: unknown;
      active?: boolean;
    },
  ) {
    await this.ensureOwned(tenantId, id);
    if (dto.itemId || dto.assignedUserId) {
      await this.ensureItemAndUser(tenantId, dto.itemId, dto.assignedUserId);
    }
    const data: ScheduleUpdateData = {};
    if (dto.reminderTimeOfDay !== undefined) data.reminderTimeOfDay = dto.reminderTimeOfDay;
    if (dto.active !== undefined) data.active = dto.active;
    if (dto.recurrence !== undefined) data.recurrence = dto.recurrence as JsonInput;
    if (dto.itemId) data.item = { connect: { id: dto.itemId } };
    if (dto.assignedUserId) data.assignedUser = { connect: { id: dto.assignedUserId } };
    return this.prisma.schedule.update({ where: { id }, data });
  }

  @Roles("OWNER", "MANAGER")
  @Delete(":id")
  async remove(@TenantId() tenantId: string, @Param("id") id: string) {
    await this.ensureOwned(tenantId, id);
    await this.prisma.schedule.delete({ where: { id } });
    return { ok: true };
  }

  private async ensureOwned(tenantId: string, id: string) {
    const found = await this.prisma.schedule.findFirst({ where: { id, tenantId } });
    if (!found) throw new NotFoundException("Schedule not found");
  }

  private async ensureItemAndUser(tenantId: string, itemId?: string, userId?: string) {
    if (itemId) {
      const item = await this.prisma.item.findFirst({ where: { id: itemId, tenantId } });
      if (!item) throw new BadRequestException("Unknown item");
    }
    if (userId) {
      const user = await this.prisma.user.findFirst({ where: { id: userId, tenantId } });
      if (!user) throw new BadRequestException("Unknown assignee");
    }
  }
}
