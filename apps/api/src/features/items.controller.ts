import {
  BadRequestException,
  Body,
  ConflictException,
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
import { createItemSchema } from "@poruchka/shared";
import { SupabaseAuthGuard } from "../auth/supabase-auth.guard";
import { TenantId } from "../auth/request-context";
import { Roles } from "../auth/roles.decorator";
import { RolesGuard } from "../auth/roles.guard";
import { ZodValidationPipe } from "../common/zod-validation.pipe";
import { PrismaService } from "../prisma/prisma.service";

@UseGuards(SupabaseAuthGuard, RolesGuard)
@Controller("items")
export class ItemsController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  list(@TenantId() tenantId: string) {
    return this.prisma.item.findMany({ where: { tenantId }, orderBy: { name: "asc" }, include: { supplier: true } });
  }

  @Roles("OWNER", "MANAGER")
  @Post()
  async create(
    @TenantId() tenantId: string,
    @Body(new ZodValidationPipe(createItemSchema)) dto: { name: string; supplierId: string; unit?: string; notes?: string },
  ) {
    await this.ensureSupplier(tenantId, dto.supplierId);
    return this.prisma.item.create({
      data: { tenantId, name: dto.name, supplierId: dto.supplierId, unit: dto.unit, notes: dto.notes },
    });
  }

  @Roles("OWNER", "MANAGER")
  @Patch(":id")
  async update(
    @TenantId() tenantId: string,
    @Param("id") id: string,
    @Body(new ZodValidationPipe(createItemSchema.partial())) dto: { name?: string; supplierId?: string; unit?: string; notes?: string },
  ) {
    await this.ensureOwned(tenantId, id);
    if (dto.supplierId) await this.ensureSupplier(tenantId, dto.supplierId);
    return this.prisma.item.update({ where: { id }, data: dto });
  }

  @Roles("OWNER", "MANAGER")
  @Delete(":id")
  async remove(@TenantId() tenantId: string, @Param("id") id: string) {
    await this.ensureOwned(tenantId, id);
    try {
      await this.prisma.item.delete({ where: { id } });
    } catch (error) {
      // OrderRuleLine.itemId and OrderRunLine.itemId are onDelete: Restrict, so
      // an item that any plan or order references cannot be deleted. Report it as
      // 409, which the web admin maps to "this item is used in a plan"; a 500 read
      // as a server fault and invited an endless retry.
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2003") {
        throw new ConflictException("Item is still referenced by a plan or an order");
      }
      throw error;
    }
    return { ok: true };
  }

  private async ensureOwned(tenantId: string, id: string) {
    const found = await this.prisma.item.findFirst({ where: { id, tenantId } });
    if (!found) throw new NotFoundException("Item not found");
  }

  private async ensureSupplier(tenantId: string, supplierId: string) {
    const sup = await this.prisma.supplier.findFirst({ where: { id: supplierId, tenantId } });
    if (!sup) throw new BadRequestException("Unknown supplier");
  }
}
