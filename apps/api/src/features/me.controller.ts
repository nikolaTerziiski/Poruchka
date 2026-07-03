import { Body, Controller, Get, Patch, UseGuards } from "@nestjs/common";
import { updateMeSchema, type UpdateMeInput } from "@poruchka/shared";
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

  /** Self-service: update the caller's own display name (used in bot messages). */
  @Patch()
  async update(
    @CurrentUser() user: { id: string },
    @Body(new ZodValidationPipe(updateMeSchema)) dto: UpdateMeInput,
  ) {
    const updated = await this.prisma.user.update({
      where: { id: user.id },
      data: { name: dto.name },
    });
    return { id: updated.id, name: updated.name, role: updated.role };
  }
}
