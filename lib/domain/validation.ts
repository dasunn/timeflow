import { z } from "zod";
import { isReminderChoice } from "@/lib/domain/reminders";

const hexColor = z
  .string()
  .regex(/^#[0-9a-fA-F]{6}$/, "Must be a hex color like #3b82f6");

export const categorySchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(60),
  color: hexColor,
});
export type CategoryInput = z.infer<typeof categorySchema>;

// Times are passed as ISO strings from the client and coerced to Date.
export const taskCreateSchema = z
  .object({
    description: z.string().trim().min(1, "Description is required").max(500),
    categoryId: z.string().nullable().optional(),
    plannedStart: z.coerce.date(),
    plannedEnd: z.coerce.date(),
    // null = no reminder; otherwise minutes-before from REMINDER_CHOICES.
    notifyMinutesBefore: z
      .number()
      .int()
      .refine(isReminderChoice, "Invalid reminder")
      .nullable()
      .optional(),
  })
  .refine((v) => v.plannedEnd.getTime() > v.plannedStart.getTime(), {
    message: "End must be after start",
    path: ["plannedEnd"],
  });
export type TaskCreateInput = z.infer<typeof taskCreateSchema>;

// Manual edit of a clock session's times (after the fact).
export const sessionEditSchema = z
  .object({
    clockInAt: z.coerce.date(),
    clockOutAt: z.coerce.date().nullable(),
  })
  .refine(
    (v) => v.clockOutAt === null || v.clockOutAt.getTime() >= v.clockInAt.getTime(),
    { message: "Clock-out must be after clock-in", path: ["clockOutAt"] },
  );
export type SessionEditInput = z.infer<typeof sessionEditSchema>;
