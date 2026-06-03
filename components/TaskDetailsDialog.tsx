"use client";

import { format } from "date-fns";
import {
  AwardIcon,
  CheckIcon,
  PlayIcon,
  SquareIcon,
  Trash2Icon,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { StatusBadge } from "@/components/StatusBadge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  clockIn,
  clockOut,
  completeTask,
  deleteClockSession,
} from "@/lib/actions/clock";
import { cancelTask, reopenTask } from "@/lib/actions/tasks";
import {
  hasAnyClockIn,
  hasOpenSession,
  openSession,
  trackedMs,
} from "@/lib/domain/clock";
import { computeDisplayStatus } from "@/lib/domain/status";
import {
  formatClockDuration,
  formatDuration,
  formatHm,
  formatTimeRange,
} from "@/lib/domain/time";
import type { TaskWithRelations } from "@/lib/domain/types";

export function TaskDetailsDialog({
  task,
  onClose,
}: {
  task: TaskWithRelations;
  onClose: () => void;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  // Live 1s clock for the running timer / accumulating total.
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  const sessions = task.clockSessions;
  const open = hasOpenSession(sessions);
  const anyClockIn = hasAnyClockIn(sessions);
  const running = openSession(sessions);
  const runningMs = running ? now.getTime() - running.clockInAt.getTime() : 0;

  const status = computeDisplayStatus(task, now, anyClockIn, open);
  const total = trackedMs(sessions, now);
  const accent = task.category?.color ?? "var(--muted-foreground)";
  const isCancelled = task.status === "CANCELLED";
  const isCompleted = task.status === "COMPLETED";
  const awarded =
    isCompleted && task.dragDelayCount === 0 && task.autoDelayCount === 0;

  const act = (fn: () => Promise<unknown>) =>
    startTransition(async () => {
      await fn();
      router.refresh();
    });

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <div className="flex items-center gap-2 pr-6">
            <span
              className="size-3 shrink-0 rounded-full"
              style={{ backgroundColor: accent }}
            />
            <DialogTitle className="flex-1 truncate">
              {task.description}
            </DialogTitle>
            {awarded && (
              <AwardIcon className="size-4 shrink-0 text-amber-500" />
            )}
            <StatusBadge status={status} />
          </div>
          <DialogDescription>
            {format(task.plannedStart, "EEE, MMM d")} ·{" "}
            {formatTimeRange(task.plannedStart, task.plannedEnd)}
            {task.category ? ` · ${task.category.name}` : ""}
          </DialogDescription>
        </DialogHeader>

        {awarded && (
          <div className="flex items-center gap-1.5 rounded-md bg-emerald-100 px-2 py-1.5 text-xs font-medium text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-200">
            <AwardIcon className="size-4 text-amber-500" />
            Completed on time — nice work!
          </div>
        )}

        {(task.dragDelayCount > 0 || task.autoDelayCount > 0) && (
          <div className="flex gap-4 text-xs">
            <span className="text-orange-700 dark:text-orange-300">
              Drag delays: <b>{task.dragDelayCount}</b>
            </span>
            <span className="text-red-700 dark:text-red-300">
              Auto-overdue: <b>{task.autoDelayCount}</b>
            </span>
          </div>
        )}

        {/* Clock controls */}
        {!isCompleted && !isCancelled && (
          <div className="flex items-center gap-2">
            {open ? (
              <Button
                variant="outline"
                disabled={pending}
                onClick={() => act(() => clockOut(task.id))}
              >
                <SquareIcon />
                Clock out
              </Button>
            ) : (
              <Button
                disabled={pending}
                onClick={() => act(() => clockIn(task.id))}
              >
                <PlayIcon />
                Clock in
              </Button>
            )}
            {anyClockIn && !open && (
              <Button
                variant="secondary"
                disabled={pending}
                onClick={() => act(() => completeTask(task.id))}
              >
                <CheckIcon />
                Complete
              </Button>
            )}
            {open && (
              <span className="ml-auto flex items-center gap-1.5 text-sm text-emerald-600 dark:text-emerald-400">
                <span className="size-2 animate-pulse rounded-full bg-emerald-500" />
                <span className="tabular-nums">
                  {formatClockDuration(runningMs)}
                </span>
              </span>
            )}
          </div>
        )}

        {/* Sessions (read-only history) */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-medium">Time sessions</h3>
            <span className="text-sm text-muted-foreground">
              Total {formatDuration(total)}
            </span>
          </div>

          {sessions.length === 0 ? (
            <p className="text-xs text-muted-foreground">
              No sessions yet — clock in to start tracking.
            </p>
          ) : (
            <ul className="space-y-1.5">
              {sessions.map((s) => (
                <li
                  key={s.id}
                  className="flex items-center justify-between rounded-md border px-2 py-1.5 text-sm"
                >
                  <span className="tabular-nums">
                    {formatHm(s.clockInAt)} –{" "}
                    {s.clockOutAt ? (
                      formatHm(s.clockOutAt)
                    ) : (
                      <span className="text-red-600 dark:text-red-400">
                        running
                      </span>
                    )}
                  </span>
                  <span className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground tabular-nums">
                      {formatDuration(
                        (s.clockOutAt ?? now).getTime() - s.clockInAt.getTime(),
                      )}
                    </span>
                    <Button
                      size="icon-sm"
                      variant="ghost"
                      disabled={pending}
                      aria-label="Delete session"
                      onClick={() => act(() => deleteClockSession(s.id))}
                    >
                      <Trash2Icon />
                    </Button>
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>

        <DialogFooter>
          {isCancelled ? (
            <Button
              variant="secondary"
              disabled={pending}
              onClick={() => act(() => reopenTask(task.id))}
            >
              Reopen task
            </Button>
          ) : !isCompleted ? (
            <Button
              variant="destructive"
              disabled={pending}
              onClick={() => act(() => cancelTask(task.id))}
            >
              Cancel task
            </Button>
          ) : null}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
