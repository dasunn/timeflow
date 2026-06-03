import type { Task, Category, ClockSession } from "@prisma/client";

// SQLite has no native enums. The first five are the values actually stored in
// Task.status; RUNNING (a clock session is open) and PAUSED (clocked in before,
// currently stopped) are DERIVED display-only states, never persisted.
export type TaskStatus =
  | "NEW"
  | "PENDING"
  | "DELAYED"
  | "CANCELLED"
  | "COMPLETED"
  | "RUNNING"
  | "PAUSED";

// The statuses actually persisted to the DB (RUNNING/PAUSED are derived).
export const TASK_STATUSES: readonly TaskStatus[] = [
  "NEW",
  "PENDING",
  "DELAYED",
  "CANCELLED",
  "COMPLETED",
] as const;

export type { Task, Category, ClockSession };

// A task with the relations the calendar/now-panel need.
export type TaskWithRelations = Task & {
  category: Category | null;
  clockSessions: ClockSession[];
};
