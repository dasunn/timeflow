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

// Effective status to DISPLAY. The stored `status` only holds the explicit
// lifecycle states NEW/CANCELLED/COMPLETED; everything else is derived.
// Precedence: terminal states win, then the live clock lifecycle
// (RUNNING / PAUSED once the task has been worked on), then PENDING (start
// passed and never started — the urgent "not started on time" red state),
// then DELAYED (rescheduled to a slot that hasn't arrived yet), then NEW.
export function computeDisplayStatus(
  t: StatusInput,
  now: Date,
  hasClockIn: boolean,
  isRunning: boolean,
): TaskStatus {
  if (t.status === "CANCELLED") return "CANCELLED";
  if (t.status === "COMPLETED") return "COMPLETED";
  if (isRunning) return "RUNNING"; // a clock session is currently open
  if (hasClockIn) return "PAUSED"; // clocked in before, currently stopped
  // Past its planned start and never clocked in -> "not started on time".
  // This MUST outrank DELAYED: once a task's end passes, autoDelayCount gets
  // bumped (isDelayed -> true), so checking DELAYED first would mask every
  // overdue task as amber and the red PENDING pulse would never show.
  if (now.getTime() >= t.plannedStart.getTime()) return "PENDING";
  if (isDelayed(t)) return "DELAYED"; // dragged later, new slot not yet here
  return "NEW";
}

// ---- On-time award -------------------------------------------------------

// Grace window: the first clock-in may be up to 5 minutes AFTER plannedStart.
// Starting early is always fine (no lower bound).
export const ON_TIME_START_GRACE_MS = 5 * 60 * 1000;

// The "Completed on time" award is earned only when the task was actually
// worked on punctually and finished before its deadline:
//   1. status is COMPLETED,
//   2. it was clocked in (started), and the FIRST clock-in is no later than
//      plannedStart + 5 min (earlier is fine),
//   3. it was completed before plannedEnd.
// Note this is independent of the drag/auto delay counters.
export function earnedOnTimeAward(
  t: {
    status: string;
    plannedStart: Date;
    plannedEnd: Date;
    completedAt: Date | null;
  },
  firstClockInAt: Date | null,
): boolean {
  if (t.status !== "COMPLETED") return false;
  if (!t.completedAt) return false;
  if (!firstClockInAt) return false; // never started -> not eligible
  // Started within the grace window after the scheduled start.
  if (
    firstClockInAt.getTime() >
    t.plannedStart.getTime() + ON_TIME_START_GRACE_MS
  ) {
    return false;
  }
  // Finished before the scheduled end.
  return t.completedAt.getTime() <= t.plannedEnd.getTime();
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
