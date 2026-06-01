import type { TaskStatus } from "./types";

// The minimal task shape the status engine reasons about.
export interface StatusInput {
  status: string;
  plannedStart: Date;
  plannedEnd: Date;
  dragDelayCount: number;
  autoDelayCount: number;
}

// A task is "delayed" if EITHER counter is positive. The two counters are
// kept distinct everywhere — this just reports the combined boolean.
export function isDelayed(t: {
  dragDelayCount: number;
  autoDelayCount: number;
}): boolean {
  return t.dragDelayCount > 0 || t.autoDelayCount > 0;
}

// Effective status to DISPLAY (the stored `status` only ever holds the
// explicit lifecycle states NEW/CANCELLED/COMPLETED; PENDING and DELAYED are
// derived). Precedence: terminal states win, then DELAYED, then PENDING.
export function computeDisplayStatus(
  t: StatusInput,
  now: Date,
  hasClockIn: boolean,
): TaskStatus {
  if (t.status === "CANCELLED") return "CANCELLED";
  if (t.status === "COMPLETED") return "COMPLETED";
  if (isDelayed(t)) return "DELAYED";
  if (now.getTime() >= t.plannedStart.getTime() && !hasClockIn) return "PENDING";
  return "NEW";
}

// Locking: once a task has been clocked in at least once OR is completed, it
// can no longer be dragged.
export function isLockable(hasClockIn: boolean, status: string): boolean {
  return hasClockIn || status === "COMPLETED";
}

// ---- Delay rules ----------------------------------------------------------

// Manual drag delay: counts only when moved to a strictly LATER start.
// Earlier or same slot never decreases (or changes) the count.
export function isLaterDrag(oldStart: Date, newStart: Date): boolean {
  return newStart.getTime() > oldStart.getTime();
}

// Auto-overdue: end time has passed with no clock-in on a still-active task.
// Guarded by autoDelayCount === 0 so repeated page loads / interval ticks
// can't double-count the same overdue pass. Tracked entirely separately from
// the manual drag counter.
export function shouldAutoDelay(
  t: { status: string; plannedEnd: Date; autoDelayCount: number },
  now: Date,
  hasClockIn: boolean,
): boolean {
  if (t.status === "COMPLETED" || t.status === "CANCELLED") return false;
  if (hasClockIn) return false;
  if (t.autoDelayCount > 0) return false;
  return now.getTime() > t.plannedEnd.getTime();
}
