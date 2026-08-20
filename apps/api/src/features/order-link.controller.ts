import { Controller, Get, Param, Post, NotFoundException, UseGuards } from "@nestjs/common";
import { SupabaseAuthGuard } from "../auth/supabase-auth.guard";
import { TenantId } from "../auth/request-context";
import { PrismaService } from "../prisma/prisma.service";
import { OrderLinkService } from "./order-link.service";

/**
 * PUBLIC, UNAUTHENTICATED endpoints backing the one-tap confirm page.
 *
 * These deliberately carry no guard: the whole point is that a cook with no
 * account and no app can confirm an order from a link. The signed token IS the
 * credential — see OrderLinkService for why that is safe and what it is scoped
 * to. Nothing here accepts an order id directly, so a token cannot be forged by
 * substituting one.
 *
 * Failure responses are deliberately coarse. Distinguishing "bad signature"
 * from "no such order" would let someone probe which order ids exist, so every
 * failure maps to the same 404 and the specific reason stays server-side.
 */
@Controller("public/orders")
export class PublicOrderLinkController {
  constructor(private readonly links: OrderLinkService) {}

  @Get(":token")
  async view(@Param("token") token: string) {
    const result = await this.links.view(token);
    if (!result.ok) throw new NotFoundException({ reason: result.reason });
    return result;
  }

  @Post(":token/confirm")
  async confirm(@Param("token") token: string) {
    const result = await this.links.submit(token);
    if (!result.ok) throw new NotFoundException({ reason: result.reason });
    return result;
  }
}

/**
 * Authenticated companion: hands the signed URL back to the web admin so an
 * owner can copy it into SMS, Viber or whatever their staff actually use during
 * the pilot. Tenant-scoped, so one restaurant cannot mint links for another's
 * orders.
 */
@UseGuards(SupabaseAuthGuard)
@Controller("order-links")
export class OrderLinkAdminController {
  constructor(
    private readonly links: OrderLinkService,
    private readonly prisma: PrismaService,
  ) {}

  @Get(":orderRunId")
  async linkFor(@Param("orderRunId") orderRunId: string, @TenantId() tenantId: string) {
    const run = await this.prisma.orderRun.findFirst({
      where: { id: orderRunId, tenantId },
      select: { id: true },
    });
    if (!run) throw new NotFoundException("Order not found");

    const base = process.env.PUBLIC_WEB_URL ?? "http://localhost:3002";
    return { url: this.links.createUrl(run.id, base) };
  }
}
