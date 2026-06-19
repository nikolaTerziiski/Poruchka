import { Body, Controller, Delete, Get, NotFoundException, Param, Patch, Post, UseGuards } from "@nestjs/common";
import { createSupplierSchema } from "@poruchka/shared";
import { SupabaseAuthGuard } from "../auth/supabase-auth.guard";
import { TenantId } from "../auth/request-context";
import { ZodValidationPipe } from "../common/zod-validation.pipe";
import { PrismaService } from "../prisma/prisma.service";

@UseGuards(SupabaseAuthGuard)
@Controller("suppliers")
export class SuppliersController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  list(@TenantId() tenantId: string) {
    return this.prisma.supplier.findMany({ where: { tenantId }, orderBy: { name: "asc" } });
  }

  @Post()
  create(
    @TenantId() tenantId: string,
    @Body(new ZodValidationPipe(createSupplierSchema)) dto: { name: string; contact?: string },
  ) {
    return this.prisma.supplier.create({ data: { tenantId, name: dto.name, contact: dto.contact } });
  }

  @Patch(":id")
  async update(
    @TenantId() tenantId: string,
    @Param("id") id: string,
    @Body(new ZodValidationPipe(createSupplierSchema.partial())) dto: { name?: string; contact?: string },
  ) {
    await this.ensureOwned(tenantId, id);
    return this.prisma.supplier.update({ where: { id }, data: dto });
  }

  @Delete(":id")
  async remove(@TenantId() tenantId: string, @Param("id") id: string) {
    await this.ensureOwned(tenantId, id);
    await this.prisma.supplier.delete({ where: { id } });
    return { ok: true };
  }

  private async ensureOwned(tenantId: string, id: string) {
    const found = await this.prisma.supplier.findFirst({ where: { id, tenantId } });
    if (!found) throw new NotFoundException("Supplier not found");
  }
}
