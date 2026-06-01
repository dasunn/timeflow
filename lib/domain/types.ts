import type { Task, Category, ClockSession } from "@prisma/client";

// SQLite has no native enums; this is the allowed set for Task.status.
export type TaskStatus =
  | "NEW"
  | "PENDING"
  | "DELAYED"
  | "CANCELLED"
  | "COMPLETED";

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
