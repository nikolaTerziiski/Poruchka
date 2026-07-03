import { BadRequestException, Body, Controller, Patch, UseGuards } from "@nestjs/common";
import { IANAZone } from "luxon";
import { updateTenantSettingsSchema, type UpdateTenantSettingsInput } from "@poruchka/shared";
import { SupabaseAuthGuard } from "../auth/supabase-auth.guard";
import { TenantId } from "../auth/request-context";
import { Roles } from "../auth/roles.decorator";
import { RolesGuard } from "../auth/roles.guard";
import { ZodValidationPipe } from "../common/zod-validation.pipe";
import { PrismaService } from "../prisma/prisma.service";

/**
 * Tenant-wide settings (restaurant info + notification behavior). Reads come
 * from GET /me, which already returns the full tenant.
 */
@UseGuards(SupabaseAuthGuard, RolesGuard)
@Controller("settings")
export class SettingsController {
  constructor(private readonly prisma: PrismaService) {}

  @Roles("OWNER", "MANAGER")
  @Patch()
  async update(
    @TenantId() tenantId: string,
    @Body(new ZodValidationPipe(updateTenantSettingsSchema)) dto: UpdateTenantSettingsInput,
  ) {
    if (dto.timezone !== undefined && !IANAZone.isValidZone(dto.timezone)) {
      throw new BadRequestException("Invalid timezone");
    }
    return this.prisma.tenant.update({ where: { id: tenantId }, data: dto });
  }
}
