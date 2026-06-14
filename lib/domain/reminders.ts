import { formatHm } from "@/lib/domain/time";

// How many minutes before a task's planned start a reminder can fire.
// `null` (absent from this list) means notifications are turned off.
export const REMINDER_CHOICES = [5, 10, 15, 20] as const;
export type ReminderChoice = (typeof REMINDER_CHOICES)[number];

// New tasks default to a 5-minute heads-up; the user can change or disable it.
export const DEFAULT_REMINDER_MINUTES: ReminderChoice = 5;

export function isReminderChoice(value: number): value is ReminderChoice {
  return (REMINDER_CHOICES as readonly number[]).includes(value);
}

// Parse a <select> value ("off" | "5" | …) into the stored shape.
export function parseReminderValue(value: string): ReminderChoice | null {
  if (value === "off") return null;
  const n = Number(value);
  return isReminderChoice(n) ? n : null;
}

// The instant a reminder should fire: `minutesBefore` ahead of the start.
export function reminderAtMs(plannedStartMs: number, minutesBefore: number): number {
  return plannedStartMs - minutesBefore * 60_000;
}

// Title/body for the browser Notification. Uses the *actual* time remaining so
// the copy stays honest even if delivery lands a tick late.
export function reminderNotification(
  description: string,
  plannedStartMs: number,
  nowMs: number,
): { title: string; body: string } {
  const mins = Math.max(0, Math.round((plannedStartMs - nowMs) / 60_000));
  const lead = mins === 0 ? "now" : `in ${mins} min`;
  return {
    title: `Task starting ${lead}`,
    body: `${description} · ${formatHm(new Date(plannedStartMs))}`,
  };
}
