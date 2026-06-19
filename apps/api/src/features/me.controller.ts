import { Controller, Get, UseGuards } from "@nestjs/common";
import { SupabaseAuthGuard } from "../auth/supabase-auth.guard";
import { CurrentUser, TenantId } from "../auth/request-context";
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
}
