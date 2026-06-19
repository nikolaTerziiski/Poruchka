import {
  CanActivate,
  ExecutionContext,
  Injectable,
  InternalServerErrorException,
  UnauthorizedException,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { PrismaService } from "../prisma/prisma.service";
import { verifySupabaseJwt } from "./supabase-jwt";

/**
 * Verifies the Supabase access token (HS256, signed with SUPABASE_JWT_SECRET)
 * and resolves the caller's tenant + user, auto-provisioning them on first
 * request (first-login onboarding). Attaches { userId, tenantId, user } to req.
 */
@Injectable()
export class SupabaseAuthGuard implements CanActivate {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {}

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const req = ctx.switchToHttp().getRequest();
    const header: string | undefined = req.headers?.authorization;
    if (!header?.startsWith("Bearer ")) {
      throw new UnauthorizedException("Missing bearer token");
    }
    const supabaseUrl = this.config.get<string>("SUPABASE_URL");
    if (!supabaseUrl) {
      throw new InternalServerErrorException("SUPABASE_URL is not set");
    }
    const jwksUrl = `${supabaseUrl}/auth/v1/.well-known/jwks.json`;

    let payload;
    try {
      payload = await verifySupabaseJwt(header.slice(7), jwksUrl);
    } catch {
      throw new UnauthorizedException("Invalid or expired token");
    }

    const authUserId = payload.sub;
    let user = await this.prisma.user.findUnique({
      where: { supabaseAuthId: authUserId },
    });

    if (!user) {
      // First login → create the restaurant tenant + owner user.
      const name =
        payload.user_metadata?.restaurant_name ||
        (payload.email ? `${payload.email.split("@")[0]}'s restaurant` : "My restaurant");
      const tenant = await this.prisma.tenant.create({ data: { name } });
      user = await this.prisma.user.create({
        data: {
          tenantId: tenant.id,
          name: payload.email ?? "Owner",
          role: "OWNER",
          supabaseAuthId: authUserId,
        },
      });
    }

    req.poruchka = { userId: user.id, tenantId: user.tenantId, user };
    return true;
  }
}
