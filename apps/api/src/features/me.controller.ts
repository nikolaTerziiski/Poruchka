import { BadRequestException, Body, Controller, Get, Patch, UseGuards } from "@nestjs/common";
import { DateTime } from "luxon";
import {
  updateTenantSettingsSchema,
  type UpdateTenantSettingsInput,
} from "@poruchka/shared";
import { SupabaseAuthGuard } from "../auth/supabase-auth.guard";
import { CurrentUser, TenantId } from "../auth/request-context";
import { ZodValidationPipe } from "../common/zod-validation.pipe";
import { PrismaService } from "../prisma/prisma.service";

@UseGuards(SupabaseAuthGuard)
@Controller("me")
export class MeController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  async me(@CurrentUser() user: { id: string; name: string; role: string }, @TenantId() tenantId: string) {
    const tenant = await this.prisma.tenant.findUnique({ where: { id: tenantId } });
    return {
      user: { id: user.id, name: user.name, role: user.role },
      tenant,
    };
  }

  @Patch("settings")
  async updateSettings(
    @TenantId() tenantId: string,
    @Body(new ZodValidationPipe(updateTenantSettingsSchema)) dto: UpdateTenantSettingsInput,
  ) {
    if (!DateTime.local().setZone(dto.timezone).isValid) {
      throw new BadRequestException("Unknown timezone");
    }
    // Equal start/end would silently disable quiet hours entirely (the scheduler
    // treats start === end as "no quiet window"), causing 3am nudges. Reject it so
    // the setting can't quietly turn itself off.
    if (dto.quietHoursStart === dto.quietHoursEnd) {
      throw new BadRequestException("Quiet hours start and end cannot be the same");
    }
    return this.prisma.tenant.update({
      where: { id: tenantId },
      data: dto,
    });
  }
}
