import { Controller, Get, UseGuards } from "@nestjs/common";
import { SupabaseAuthGuard } from "../auth/supabase-auth.guard";
import { TenantId } from "../auth/request-context";
import { PrismaService } from "../prisma/prisma.service";

@UseGuards(SupabaseAuthGuard)
@Controller("team")
export class TeamController {
  constructor(private readonly prisma: PrismaService) {}

  /** Tenant members — used to assign a responsible person to a schedule. */
  @Get()
  list(@TenantId() tenantId: string) {
    return this.prisma.user.findMany({
      where: { tenantId },
      orderBy: { createdAt: "asc" },
      select: { id: true, name: true, role: true, chatChannel: true, chatUserId: true },
    });
  }
}
