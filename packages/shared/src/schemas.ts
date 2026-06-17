import { z } from "zod";
import { recurrenceSchema } from "./recurrence";

export const roleSchema = z.enum(["OWNER", "MANAGER", "STAFF"]);
export type Role = z.infer<typeof roleSchema>;

export const chatChannelSchema = z.enum(["TELEGRAM", "VIBER", "WHATSAPP"]);
export type ChatChannel = z.infer<typeof chatChannelSchema>;

export const reminderStatusSchema = z.enum([
  "PENDING",
  "CONFIRMED",
  "ESCALATED",
  "CANCELLED",
]);
export type ReminderStatus = z.infer<typeof reminderStatusSchema>;

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

export const createScheduleSchema = z.object({
  itemId: z.string().uuid(),
  assignedUserId: z.string().uuid(),
  reminderTimeOfDay: timeOfDaySchema,
  recurrence: recurrenceSchema,
});
export type CreateScheduleInput = z.infer<typeof createScheduleSchema>;
