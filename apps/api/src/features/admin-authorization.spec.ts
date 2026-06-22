import "reflect-metadata";
import { ROLES_KEY } from "../auth/roles.decorator";
import { ItemsController } from "./items.controller";
import { OrderRulesController } from "./order-rules.controller";
import { SuppliersController } from "./suppliers.controller";
import { TeamController } from "./team.controller";

type ControllerClass = { prototype: object };

function rolesFor(controller: ControllerClass, method: string): string[] {
  const handler = (controller.prototype as Record<string, unknown>)[method];
  expect(typeof handler).toBe("function");
  return Reflect.getMetadata(ROLES_KEY, handler as object) ?? [];
}

describe("administrative mutation authorization metadata", () => {
  it("limits team administration to owners", () => {
    for (const method of ["create", "telegramLink", "unlink", "remove"]) {
      expect(rolesFor(TeamController, method)).toEqual(["OWNER"]);
    }
  });

  it("allows owners and managers to manage suppliers", () => {
    for (const method of ["create", "update", "remove"]) {
      expect(rolesFor(SuppliersController, method)).toEqual(["OWNER", "MANAGER"]);
    }
  });

  it("allows owners and managers to manage items", () => {
    for (const method of ["create", "update", "remove"]) {
      expect(rolesFor(ItemsController, method)).toEqual(["OWNER", "MANAGER"]);
    }
  });

  it("allows owners and managers to manage order rules", () => {
    for (const method of ["create", "update", "remove"]) {
      expect(rolesFor(OrderRulesController, method)).toEqual(["OWNER", "MANAGER"]);
    }
  });
});
