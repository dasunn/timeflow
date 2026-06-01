"use client";

import { format } from "date-fns";
import { PlusIcon, Trash2Icon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { STATUS_META } from "@/components/status-meta";
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
  addClockSession,
  deleteClockSession,
  updateClockSession,
} from "@/lib/actions/clock";
import { cancelTask, reopenTask } from "@/lib/actions/tasks";
import { hasAnyClockIn, trackedMs } from "@/lib/domain/clock";
import { computeDisplayStatus } from "@/lib/domain/status";
import {
  formatDuration,
  formatTimeRange,
  toDatetimeLocal,
} from "@/lib/domain/time";
import type { ClockSession, TaskWithRelations } from "@/lib/domain/types";
import { cn } from "@/lib/utils";

const INPUT_CLASS =
  "h-7 rounded-md border border-input bg-transparent px-2 text-xs outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/50 dark:bg-input/30";

export function TaskDetailsDialog({
  task,
  onClose,
}: {
  task: TaskWithRelations;
  onClose: () => void;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const now = new Date();
  const status = computeDisplayStatus(task, now, hasAnyClockIn(task.clockSessions));
  const meta = STATUS_META[status];
  const total = trackedMs(task.clockSessions, now);
  const accent = task.category?.color ?? "var(--muted-foreground)";
  const isCancelled = task.status === "CANCELLED";
  const isCompleted = task.status === "COMPLETED";

  const refresh = () => router.refresh();
  const act = (fn: () => Promise<unknown>) =>
    startTransition(async () => {
      await fn();
      refresh();
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
            <span
              className={cn(
                "shrink-0 rounded px-1.5 py-0.5 text-[11px] font-medium",
                meta.className,
              )}
            >
              {meta.label}
            </span>
          </div>
          <DialogDescription>
            {format(task.plannedStart, "EEE, MMM d")} ·{" "}
            {formatTimeRange(task.plannedStart, task.plannedEnd)}
            {task.category ? ` · ${task.category.name}` : ""}
          </DialogDescription>
        </DialogHeader>

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

        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-medium">Time sessions</h3>
            <span className="text-sm text-muted-foreground">
              Total {formatDuration(total)}
            </span>
          </div>

          {task.clockSessions.length === 0 ? (
            <p className="text-xs text-muted-foreground">No sessions yet.</p>
          ) : (
            <ul className="space-y-2">
              {task.clockSessions.map((s) => (
                <SessionRow key={s.id} session={s} onChanged={refresh} />
              ))}
            </ul>
          )}

          <Button
            variant="outline"
            size="sm"
            disabled={pending}
            onClick={() => act(() => addClockSession(task.id))}
          >
            <PlusIcon />
            Add session
          </Button>
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

function SessionRow({
  session,
  onChanged,
}: {
  session: ClockSession;
  onChanged: () => void;
}) {
  const [pending, startTransition] = useTransition();
  const inOriginal = toDatetimeLocal(session.clockInAt);
  const outOriginal = session.clockOutAt ? toDatetimeLocal(session.clockOutAt) : "";
  const [inVal, setInVal] = useState(inOriginal);
  const [outVal, setOutVal] = useState(outOriginal);
  const [error, setError] = useState<string | null>(null);
  const dirty = inVal !== inOriginal || outVal !== outOriginal;

  function save() {
    setError(null);
    const inMs = new Date(inVal).getTime();
    const outMs = outVal ? new Date(outVal).getTime() : null;
    if (Number.isNaN(inMs)) {
      setError("Invalid start time");
      return;
    }
    if (outMs !== null && outMs < inMs) {
      setError("End is before start");
      return;
    }
    startTransition(async () => {
      const res = await updateClockSession(session.id, inMs, outMs);
      if (res.ok) onChanged();
      else setError(res.error);
    });
  }

  function del() {
    startTransition(async () => {
      await deleteClockSession(session.id);
      onChanged();
    });
  }

  return (
    <li className="rounded-md border p-2">
      <div className="flex flex-wrap items-center gap-2">
        <input
          type="datetime-local"
          value={inVal}
          onChange={(e) => setInVal(e.target.value)}
          className={INPUT_CLASS}
        />
        <span className="text-muted-foreground">→</span>
        <input
          type="datetime-local"
          value={outVal}
          onChange={(e) => setOutVal(e.target.value)}
          className={INPUT_CLASS}
        />
        <div className="ml-auto flex items-center gap-1">
          {dirty && (
            <Button size="sm" disabled={pending} onClick={save}>
              Save
            </Button>
          )}
          <Button
            size="icon-sm"
            variant="ghost"
            disabled={pending}
            aria-label="Delete session"
            onClick={del}
          >
            <Trash2Icon />
          </Button>
        </div>
      </div>
      {!outVal && (
        <p className="mt-1 text-[11px] text-red-600 dark:text-red-400">
          Running — leave end empty to keep open.
        </p>
      )}
      {error && (
        <p className="mt-1 text-[11px] text-destructive">{error}</p>
      )}
    </li>
  );
}
