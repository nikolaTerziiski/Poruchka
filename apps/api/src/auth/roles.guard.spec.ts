import "reflect-metadata";
import { ExecutionContext, ForbiddenException, UnauthorizedException } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { ROLES_KEY, type Role } from "./roles.decorator";
import { RolesGuard } from "./roles.guard";

function context(handler: () => void, user?: { role?: Role }): ExecutionContext {
  return {
    getHandler: () => handler,
    getClass: () => class TestController {},
    switchToHttp: () => ({
      getRequest: () => (user ? { poruchka: { user } } : {}),
    }),
  } as unknown as ExecutionContext;
}

describe("RolesGuard", () => {
  const guard = new RolesGuard(new Reflector());

  it("allows authenticated users with an allowed role", () => {
    const handler = () => undefined;
    Reflect.defineMetadata(ROLES_KEY, ["OWNER", "MANAGER"], handler);

    expect(guard.canActivate(context(handler, { role: "MANAGER" }))).toBe(true);
  });

  it("denies authenticated users without an allowed role", () => {
    const handler = () => undefined;
    Reflect.defineMetadata(ROLES_KEY, ["OWNER", "MANAGER"], handler);

    expect(() => guard.canActivate(context(handler, { role: "STAFF" }))).toThrow(
      ForbiddenException,
    );
  });

  it("denies unauthenticated requests when a role is required", () => {
    const handler = () => undefined;
    Reflect.defineMetadata(ROLES_KEY, ["OWNER"], handler);

    expect(() => guard.canActivate(context(handler))).toThrow(UnauthorizedException);
  });

  it("allows routes with no role requirement", () => {
    const handler = () => undefined;

    expect(guard.canActivate(context(handler))).toBe(true);
  });
});
