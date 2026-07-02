import { addMonths, format, startOfMonth } from "date-fns";
import { addDays, startOfDay, weekStart } from "./time";
import { trackedMs } from "./clock";
import type { TaskWithRelations } from "./types";

export type DashboardPeriod = "today" | "week" | "month" | "all";

export const DASHBOARD_PERIODS: readonly DashboardPeriod[] = [
  "today",
  "week",
  "month",
  "all",
] as const;

export function isDashboardPeriod(value: string): value is DashboardPeriod {
  return (DASHBOARD_PERIODS as readonly string[]).includes(value);
}

// "YYYY-MM" -> the 1st of that month (local time). Falls back to `now` on
// anything unparseable so a malformed URL param never throws.
function parseMonthParam(value: string, now: Date): Date {
  const [year, month] = value.split("-").map(Number);
  if (!year || !month || month < 1 || month > 12) return now;
  return new Date(year, month - 1, 1);
}

export interface DashboardRange {
  start: Date | null;
  end: Date | null;
  label: string;
}

// Resolves a filter period (+ optional "YYYY-MM" month param) into a
// half-open [start, end) date range and a human label. `all` has no bounds.
export function resolveDateRange(
  period: DashboardPeriod,
  monthParam: string | undefined,
  now: Date,
): DashboardRange {
  switch (period) {
    case "today": {
      const start = startOfDay(now);
      return { start, end: addDays(start, 1), label: format(now, "EEEE, MMM d, yyyy") };
    }
    case "week": {
      const start = weekStart(now);
      const end = addDays(start, 7);
      return {
        start,
        end,
        label: `${format(start, "MMM d")} – ${format(addDays(start, 6), "MMM d, yyyy")}`,
      };
    }
    case "month": {
      const anchor = monthParam ? parseMonthParam(monthParam, now) : now;
      const start = startOfMonth(anchor);
      const end = startOfMonth(addMonths(anchor, 1));
      return { start, end, label: format(anchor, "MMMM yyyy") };
    }
    case "all":
      return { start: null, end: null, label: "All time" };
  }
}

export interface DashboardStats {
  totalTasks: number;
  completedTasks: number;
  plannedMs: number;
  actualMs: number;
}

// CANCELLED tasks are expected to already be excluded by the caller's query.
export function computeDashboardStats(
  tasks: TaskWithRelations[],
  now: Date,
): DashboardStats {
  let plannedMs = 0;
  let actualMs = 0;
  let completedTasks = 0;
  for (const t of tasks) {
    plannedMs += Math.max(0, t.plannedEnd.getTime() - t.plannedStart.getTime());
    actualMs += trackedMs(t.clockSessions, now);
    if (t.status === "COMPLETED") completedTasks++;
  }
  return { totalTasks: tasks.length, completedTasks, plannedMs, actualMs };
}

export interface CategoryTimeSlice {
  categoryId: string | null;
  name: string;
  color: string;
  plannedMs: number;
  actualMs: number;
}

const UNCATEGORIZED_COLOR = "#94a3b8"; // slate-400 — matches muted UI tones

// Groups tasks by category and sums planned/actual time per category, for
// the donut chart. CANCELLED tasks are expected to already be excluded by
// the caller's query. Sorted by planned time descending.
export function computeCategoryBreakdown(
  tasks: TaskWithRelations[],
  now: Date,
): CategoryTimeSlice[] {
  const slices = new Map<string, CategoryTimeSlice>();
  for (const t of tasks) {
    const key = t.categoryId ?? "uncategorized";
    let slice = slices.get(key);
    if (!slice) {
      slice = {
        categoryId: t.categoryId,
        name: t.category?.name ?? "Uncategorized",
        color: t.category?.color ?? UNCATEGORIZED_COLOR,
        plannedMs: 0,
        actualMs: 0,
      };
      slices.set(key, slice);
    }
    slice.plannedMs += Math.max(0, t.plannedEnd.getTime() - t.plannedStart.getTime());
    slice.actualMs += trackedMs(t.clockSessions, now);
  }
  return Array.from(slices.values()).sort((a, b) => b.plannedMs - a.plannedMs);
}
