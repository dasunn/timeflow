"use client";

import { useDraggable } from "@dnd-kit/core";
import {
  AlarmClockOffIcon,
  ArrowDownIcon,
  LockIcon,
} from "lucide-react";
import { useNow } from "@/components/now-context";
import { hasAnyClockIn } from "@/lib/domain/clock";
import { computeDisplayStatus } from "@/lib/domain/status";
import { formatTimeRange, heightPx, topPx } from "@/lib/domain/time";
import type { TaskStatus, TaskWithRelations } from "@/lib/domain/types";
import { cn } from "@/lib/utils";
import type { LaidOutTask } from "./layout";

const STATUS_META: Record<TaskStatus, { label: string; badge: string }> = {
  NEW: { label: "New", badge: "bg-secondary text-secondary-foreground" },
  PENDING: {
    label: "Pending",
    badge: "bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300",
  },
  DELAYED: {
    label: "Delayed",
    badge: "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300",
  },
  CANCELLED: { label: "Cancelled", badge: "bg-muted text-muted-foreground" },
  COMPLETED: {
    label: "Done",
    badge:
      "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300",
  },
};

export function TaskCard({ task, lane, lanes }: LaidOutTask) {
  const now = useNow();
  const clockedIn = hasAnyClockIn(task.clockSessions);
  const status = computeDisplayStatus(task, now, clockedIn);
  const meta = STATUS_META[status];
  const locked = task.isLocked;

  const { attributes, listeners, setNodeRef, transform, isDragging } =
    useDraggable({ id: task.id, data: { task }, disabled: locked });

  const top = topPx(task.plannedStart);
  const height = heightPx(task.plannedStart, task.plannedEnd);
  const widthPct = 100 / lanes;
  const leftPct = lane * widthPct;
  const accent = task.category?.color ?? "var(--muted-foreground)";
  const terminal = status === "CANCELLED" || status === "COMPLETED";

  return (
    <div
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      className={cn(
        "absolute z-0 p-px outline-none",
        locked ? "cursor-not-allowed" : "cursor-grab",
        isDragging && "z-50 cursor-grabbing",
      )}
      style={{
        top,
        height,
        left: `${leftPct}%`,
        width: `${widthPct}%`,
        touchAction: "none",
        transform: transform
          ? `translate3d(${transform.x}px, ${transform.y}px, 0)`
          : undefined,
      }}
    >
      <div
        className={cn(
          "flex h-full flex-col overflow-hidden rounded-md border bg-card px-1.5 py-1 text-xs shadow-sm",
          status === "DELAYED" && "ring-1 ring-amber-300 dark:ring-amber-800",
          terminal && "opacity-70",
          isDragging && "shadow-lg ring-2 ring-ring",
        )}
        style={{ borderLeftColor: accent, borderLeftWidth: 4 }}
      >
        <div className="flex items-start justify-between gap-1">
          <span className="truncate text-[10px] leading-tight text-muted-foreground tabular-nums">
            {formatTimeRange(task.plannedStart, task.plannedEnd)}
          </span>
          <span className="flex shrink-0 items-center gap-1">
            {locked && <LockIcon className="size-2.5 text-muted-foreground" />}
            <span
              className={cn(
                "rounded px-1 text-[9px] leading-tight font-medium",
                meta.badge,
              )}
            >
              {meta.label}
            </span>
          </span>
        </div>

        <p
          className={cn(
            "mt-0.5 line-clamp-2 leading-tight font-medium",
            status === "CANCELLED" && "text-muted-foreground line-through",
          )}
        >
          {task.description}
        </p>

        {(task.dragDelayCount > 0 || task.autoDelayCount > 0) && (
          <div className="mt-auto flex flex-wrap items-center gap-1 pt-0.5">
            {task.dragDelayCount > 0 && (
              <span
                title={`Dragged later ${task.dragDelayCount}×`}
                className="inline-flex items-center gap-0.5 rounded bg-orange-100 px-1 text-[9px] font-medium text-orange-700 dark:bg-orange-950 dark:text-orange-300"
              >
                <ArrowDownIcon className="size-2.5" />
                {task.dragDelayCount}
              </span>
            )}
            {task.autoDelayCount > 0 && (
              <span
                title={`Auto-overdue ${task.autoDelayCount}×`}
                className="inline-flex items-center gap-0.5 rounded bg-red-100 px-1 text-[9px] font-medium text-red-700 dark:bg-red-950 dark:text-red-300"
              >
                <AlarmClockOffIcon className="size-2.5" />
                {task.autoDelayCount}
              </span>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
