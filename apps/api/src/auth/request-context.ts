import { createParamDecorator, ExecutionContext } from "@nestjs/common";

/** The resolved tenant id for the authenticated request. */
export const TenantId = createParamDecorator((_data: unknown, ctx: ExecutionContext): string => {
  return ctx.switchToHttp().getRequest().poruchka.tenantId;
});

/** The resolved User row for the authenticated request. */
export const CurrentUser = createParamDecorator((_data: unknown, ctx: ExecutionContext) => {
  return ctx.switchToHttp().getRequest().poruchka.user;
});
