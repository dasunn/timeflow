import type { TaskStatus } from "@/lib/domain/types";

// Single source of truth for status label + badge colors (used by the
// calendar cards and the Now panel).
export const STATUS_META: Record<TaskStatus, { label: string; className: string }> = {
  NEW: { label: "New", className: "bg-secondary text-secondary-foreground" },
  PENDING: {
    label: "Pending",
    className: "bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300",
  },
  DELAYED: {
    label: "Delayed",
    className:
      "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300",
  },
  CANCELLED: { label: "Cancelled", className: "bg-muted text-muted-foreground" },
  COMPLETED: {
    label: "Done",
    className: "bg-emerald-600 text-white dark:bg-emerald-600 dark:text-white",
  },
  RUNNING: {
    label: "Running",
    className:
      "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300",
  },
  PAUSED: {
    label: "Pause",
    className: "bg-sky-100 text-sky-700 dark:bg-sky-950 dark:text-sky-300",
  },
};
