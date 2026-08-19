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
  "CONFIRMED",
  "PARTIALLY_RECEIVED",
  "RECEIVED",
]);
export type OrderRunStatus = z.infer<typeof orderRunStatusSchema>;

export const receivingExceptionSchema = z.enum([
  "SHORT",
  "MISSING",
  "DAMAGED",
  "SUBSTITUTED",
]);
export type ReceivingException = z.infer<typeof receivingExceptionSchema>;

/** Local time of day in 24h "HH:mm" form. */
export const timeOfDaySchema = z
  .string()
  .regex(/^([01]\d|2[0-3]):[0-5]\d$/, "must be HH:mm");

export const createSupplierSchema = z.object({
  name: z.string().trim().min(1).max(120),
  contact: z.string().trim().max(200).optional(),
});
export type CreateSupplierInput = z.infer<typeof createSupplierSchema>;

export const createItemSchema = z.object({
  name: z.string().trim().min(1).max(120),
  supplierId: z.string().uuid(),
  unit: z.string().trim().max(50).optional(),
  notes: z.string().trim().max(500).optional(),
});
export type CreateItemInput = z.infer<typeof createItemSchema>;

export const createUserSchema = z.object({
  name: z.string().trim().min(1).max(120),
  role: roleSchema.default("STAFF"),
  chatChannel: chatChannelSchema.default("TELEGRAM"),
});
export type CreateUserInput = z.infer<typeof createUserSchema>;

const quantitySchema = z.number().finite().min(0).max(999999);
const isoDateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "must be YYYY-MM-DD");

export const orderRuleLineSchema = z.object({
  itemId: z.string().uuid(),
  defaultQuantity: quantitySchema.nullable().optional(),
  unit: z.string().trim().max(50).nullable().optional(),
  notes: z.string().trim().max(500).nullable().optional(),
  sortOrder: z.number().int().min(0).optional(),
});

export const createOrderRuleSchema = z
  .object({
    supplierId: z.string().uuid(),
    assignedUserId: z.string().uuid(),
    escalationUserId: z.string().uuid().nullable().optional(),
    reminderTimeOfDay: timeOfDaySchema,
    recurrence: recurrenceSchema,
    cutoffTime: timeOfDaySchema.nullable().optional(),
    expectedDeliveryOffsetDays: z.number().int().min(0).max(365).nullable().optional(),
    lines: z.array(orderRuleLineSchema).min(1).max(100),
  })
  .superRefine((value, ctx) => {
    const itemIds = value.lines.map((line) => line.itemId);
    if (new Set(itemIds).size !== itemIds.length) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["lines"], message: "items must be unique" });
    }
  });
export type CreateOrderRuleInput = z.infer<typeof createOrderRuleSchema>;

export const updateOrderRuleSchema = createOrderRuleSchema.and(
  z.object({ active: z.boolean().optional() }),
);
export type UpdateOrderRuleInput = z.infer<typeof updateOrderRuleSchema>;

export const updateOrderRunDraftSchema = z.object({
  lines: z
    .array(
      z.object({
        lineId: z.string().uuid(),
        quantity: quantitySchema.nullable(),
      }),
    )
    .min(1),
});
export type UpdateOrderRunDraftInput = z.infer<typeof updateOrderRunDraftSchema>;

export const snoozeOrderRunSchema = z.object({
  minutes: z.union([z.literal(30), z.literal(60), z.literal(120)]),
});
export type SnoozeOrderRunInput = z.infer<typeof snoozeOrderRunSchema>;

export const skipOrderRunSchema = z.object({
  reason: z.string().trim().max(240).nullable().optional(),
});
export type SkipOrderRunInput = z.infer<typeof skipOrderRunSchema>;

export const confirmOrderRunSchema = z.object({
  supplierReference: z.string().trim().max(120).nullable().optional(),
  expectedDeliveryDate: isoDateSchema.nullable().optional(),
});
export type ConfirmOrderRunInput = z.infer<typeof confirmOrderRunSchema>;

export const receiveOrderRunSchema = z.object({
  receivingNote: z.string().trim().max(1000).nullable().optional(),
  lines: z
    .array(
      z.object({
        lineId: z.string().uuid(),
        receivedQuantity: quantitySchema.nullable(),
        unitPrice: quantitySchema.nullable().optional(),
        exceptionType: receivingExceptionSchema.nullable().optional(),
        exceptionNote: z.string().trim().max(500).nullable().optional(),
      }),
    )
    .min(1),
});
export type ReceiveOrderRunInput = z.infer<typeof receiveOrderRunSchema>;

export const updateTenantSettingsSchema = z.object({
  timezone: z.string().trim().min(1).max(120),
  quietHoursStart: z.number().int().min(0).max(23),
  quietHoursEnd: z.number().int().min(0).max(23),
  renudgeIntervalMin: z.number().int().min(1).max(1440),
  maxNudges: z.number().int().min(1).max(20),
  language: z.enum(["bg", "en"]),
});
export type UpdateTenantSettingsInput = z.infer<typeof updateTenantSettingsSchema>;
