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

    /* An equal quiet-hours pair does not mean "quiet all day" — SchedulerService
     * .inQuietHours() returns false when start === end, so the window silently
     * turns OFF and nudges go out at 3am. The settings page already tells the
     * user the two hours must differ; enforce it here too, or a direct API call
     * (or a stale client) can still write the pair.
     *
     * The schema is .partial(), and the web sends only the field that changed,
     * so a one-sided patch has to be checked against what is stored. The extra
     * read only happens when a quiet-hours field is actually in the patch. */
    if (dto.quietHoursStart !== undefined || dto.quietHoursEnd !== undefined) {
      const stored = await this.prisma.tenant.findUnique({
        where: { id: tenantId },
        select: { quietHoursStart: true, quietHoursEnd: true },
      });
      if (!stored) throw new BadRequestException("Invalid quiet hours");
      const start = dto.quietHoursStart ?? stored.quietHoursStart;
      const end = dto.quietHoursEnd ?? stored.quietHoursEnd;
      if (start === end) {
        throw new BadRequestException("Quiet hours start and end must differ");
      }
    }

    return this.prisma.tenant.update({ where: { id: tenantId }, data: dto });
  }
}
