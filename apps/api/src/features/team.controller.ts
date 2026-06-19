import { BadRequestException, Body, Controller, Delete, Get, NotFoundException, Param, Post, UseGuards } from "@nestjs/common";
import { randomBytes } from "crypto";
import { Bot } from "grammy";
import { createUserSchema } from "@poruchka/shared";
import { SupabaseAuthGuard } from "../auth/supabase-auth.guard";
import { CurrentUser, TenantId } from "../auth/request-context";
import { ZodValidationPipe } from "../common/zod-validation.pipe";
import { PrismaService } from "../prisma/prisma.service";

const MEMBER_SELECT = { id: true, name: true, role: true, chatChannel: true, chatUserId: true } as const;

@UseGuards(SupabaseAuthGuard)
@Controller("team")
export class TeamController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly bot: Bot,
  ) {}

  @Get()
  list(@TenantId() tenantId: string) {
    return this.prisma.user.findMany({ where: { tenantId }, orderBy: { createdAt: "asc" }, select: MEMBER_SELECT });
  }

  @Post()
  create(
    @TenantId() tenantId: string,
    @Body(new ZodValidationPipe(createUserSchema)) dto: { name: string; role: "OWNER" | "MANAGER" | "STAFF"; chatChannel: "TELEGRAM" | "VIBER" | "WHATSAPP" },
  ) {
    return this.prisma.user.create({
      data: { tenantId, name: dto.name, role: dto.role, chatChannel: dto.chatChannel },
      select: MEMBER_SELECT,
    });
  }

  /** Issue a one-time Telegram deep link the member opens to connect their chat. */
  @Post(":id/telegram-link")
  async telegramLink(@TenantId() tenantId: string, @Param("id") id: string) {
    await this.ensureOwned(tenantId, id);
    const code = randomBytes(6).toString("hex");
    await this.prisma.user.update({ where: { id }, data: { linkCode: code } });
    let username: string | undefined;
    try {
      username = this.bot.botInfo.username;
    } catch {
      username = undefined;
    }
    return { code, deepLink: username ? `https://t.me/${username}?start=${code}` : null };
  }

  @Post(":id/unlink")
  async unlink(@TenantId() tenantId: string, @Param("id") id: string) {
    await this.ensureOwned(tenantId, id);
    await this.prisma.user.update({ where: { id }, data: { chatUserId: null, linkCode: null } });
    return { ok: true };
  }

  @Delete(":id")
  async remove(@TenantId() tenantId: string, @Param("id") id: string, @CurrentUser() current: { id: string }) {
    await this.ensureOwned(tenantId, id);
    if (id === current.id) throw new BadRequestException("You can't remove yourself");
    await this.prisma.user.delete({ where: { id } });
    return { ok: true };
  }

  private async ensureOwned(tenantId: string, id: string) {
    const found = await this.prisma.user.findFirst({ where: { id, tenantId } });
    if (!found) throw new NotFoundException("Member not found");
  }
}
