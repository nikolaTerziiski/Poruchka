import { z } from "zod";
import { recurrenceSchema } from "./recurrence";

export const roleSchema = z.enum(["OWNER", "MANAGER", "STAFF"]);
export type Role = z.infer<typeof roleSchema>;

export const chatChannelSchema = z.enum(["TELEGRAM", "VIBER", "WHATSAPP"]);
export type ChatChannel = z.infer<typeof chatChannelSchema>;

export const orderRunStatusSchema = z.enum([
  "PENDING",
  "SUBMITTED",
  "ESCALATED",
  "SKIPPED",
]);
export type OrderRunStatus = z.infer<typeof orderRunStatusSchema>;

/** Local time of day in 24h "HH:mm" form. */
export const timeOfDaySchema = z
  .string()
  .regex(/^([01]\d|2[0-3]):[0-5]\d$/, "must be HH:mm");

export const createSupplierSchema = z.object({
  name: z.string().min(1),
  contact: z.string().optional(),
});
export type CreateSupplierInput = z.infer<typeof createSupplierSchema>;

export const createItemSchema = z.object({
  name: z.string().min(1),
  supplierId: z.string().uuid(),
  unit: z.string().optional(),
  notes: z.string().optional(),
});
export type CreateItemInput = z.infer<typeof createItemSchema>;

export const createUserSchema = z.object({
  name: z.string().min(1),
  role: roleSchema.default("STAFF"),
  chatChannel: chatChannelSchema.default("TELEGRAM"),
});
export type CreateUserInput = z.infer<typeof createUserSchema>;

/** One line of a supplier reminder: which item to check, with an optional usual amount hint. */
export const orderRuleLineSchema = z.object({
  itemId: z.string().uuid(),
  defaultQuantity: z.number().positive().optional(),
  unit: z.string().optional(),
  notes: z.string().optional(),
  sortOrder: z.number().int().min(0).optional(),
});
export type OrderRuleLineInput = z.infer<typeof orderRuleLineSchema>;

/**
 * A recurring supplier reminder — the item checklist is sent as one message.
 * `cutoffTime` is the local deadline to handle it; orders are expected
 * to arrive `expectedDeliveryOffsetDays` later.
 */
export const createOrderRuleSchema = z.object({
  supplierId: z.string().uuid(),
  assignedUserId: z.string().uuid(),
  escalationUserId: z.string().uuid().nullable().optional(),
  reminderTimeOfDay: timeOfDaySchema,
  recurrence: recurrenceSchema,
  cutoffTime: timeOfDaySchema.optional(),
  expectedDeliveryOffsetDays: z.number().int().min(0).optional(),
  lines: z.array(orderRuleLineSchema).min(1),
});
export type CreateOrderRuleInput = z.infer<typeof createOrderRuleSchema>;

/**
 * Tenant-wide settings, all optional (PATCH semantics). Quiet hours are local
 * hours 0-23; start === end means quiet hours are disabled, start > end wraps
 * overnight. Timezone is any IANA id — semantic validity is checked API-side.
 */
export const updateTenantSettingsSchema = z
  .object({
    name: z.string().min(1),
    timezone: z.string().min(1),
    language: z.enum(["bg", "en"]),
    quietHoursStart: z.number().int().min(0).max(23),
    quietHoursEnd: z.number().int().min(0).max(23),
    renudgeIntervalMin: z.number().int().min(5).max(720),
    maxNudges: z.number().int().min(1).max(20),
  })
  .partial();
export type UpdateTenantSettingsInput = z.infer<typeof updateTenantSettingsSchema>;

/** Self-service profile update (the caller's own User row). */
export const updateMeSchema = z.object({
  name: z.string().min(1),
});
export type UpdateMeInput = z.infer<typeof updateMeSchema>;
