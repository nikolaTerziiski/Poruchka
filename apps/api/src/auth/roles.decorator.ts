import { SetMetadata } from "@nestjs/common";

export const ROLES_KEY = "poruchka:roles";
export type Role = "OWNER" | "MANAGER" | "STAFF";

/**
 * Role policy for administrative configuration:
 * - OWNER manages team membership and all restaurant configuration.
 * - MANAGER may manage operational configuration: suppliers, items, schedules.
 * - STAFF may use operational read/action flows only.
 */
export const Roles = (...roles: Role[]) => SetMetadata(ROLES_KEY, roles);
