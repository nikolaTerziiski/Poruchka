import { z } from "zod";
import { recurrenceSchema } from "./recurrence";

export const roleSchema = z.enum(["OWNER", "MANAGER", "STAFF"]);
export type Role = z.infer<typeof roleSchema>;

export const chatChannelSchema = z.enum(["TELEGRAM", "VIBER", "WHATSAPP"]);
export type ChatChannel = z.infer<typeof chatChannelSchema>;

/** Mirrors the OrderRunStatus enum in prisma/schema.prisma — keep the two in step. */
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

/** Free-text fields are trimmed and capped so a paste can't become a payload. */
const shortText = z.string().trim().min(1).max(120);

export const createSupplierSchema = z.object({
  name: shortText,
  contact: z.string().trim().max(200).optional(),
});
export type CreateSupplierInput = z.infer<typeof createSupplierSchema>;

export const createItemSchema = z.object({
  name: shortText,
  supplierId: z.string().uuid(),
  unit: z.string().trim().max(50).optional(),
  notes: z.string().trim().max(500).optional(),
});
export type CreateItemInput = z.infer<typeof createItemSchema>;

export const createUserSchema = z.object({
  name: shortText,
  role: roleSchema.default("STAFF"),
  chatChannel: chatChannelSchema.default("TELEGRAM"),
});
export type CreateUserInput = z.infer<typeof createUserSchema>;

/** One line of a supplier reminder: which item to check, with an optional usual amount hint. */
export const orderRuleLineSchema = z.object({
  itemId: z.string().uuid(),
  // Upper bound matches the bot's quantity keypad, so chat and web agree.
  defaultQuantity: z.number().positive().finite().max(999999).optional(),
  unit: z.string().trim().max(50).optional(),
  notes: z.string().trim().max(500).optional(),
  sortOrder: z.number().int().min(0).optional(),
});
export type OrderRuleLineInput = z.infer<typeof orderRuleLineSchema>;

/**
 * A recurring supplier reminder — the item checklist is sent as one message.
 * `cutoffTime` is the local deadline to handle it; orders are expected
 * to arrive `expectedDeliveryOffsetDays` later.
 *
 * Keep this a plain object schema (no .superRefine): callers derive update
 * schemas from it with .partial().extend(), which a ZodEffects cannot do.
 */
export const createOrderRuleSchema = z.object({
  supplierId: z.string().uuid(),
  assignedUserId: z.string().uuid(),
  escalationUserId: z.string().uuid().nullable().optional(),
  reminderTimeOfDay: timeOfDaySchema,
  recurrence: recurrenceSchema,
  cutoffTime: timeOfDaySchema.optional(),
  expectedDeliveryOffsetDays: z.number().int().min(0).max(365).optional(),
  lines: z.array(orderRuleLineSchema).min(1).max(100),
});
export type CreateOrderRuleInput = z.infer<typeof createOrderRuleSchema>;

/**
 * Tenant-wide settings, all optional (PATCH semantics). Quiet hours are local
 * hours 0-23; start === end means quiet hours are disabled, start > end wraps
 * overnight. Timezone is any IANA id — semantic validity is checked API-side.
 */
export const updateTenantSettingsSchema = z
  .object({
    name: shortText,
    timezone: z.string().trim().min(1).max(120),
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
  name: shortText,
});
export type UpdateMeInput = z.infer<typeof updateMeSchema>;
