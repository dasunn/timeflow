"use client";

import { format } from "date-fns";
import {
  AwardIcon,
  BellIcon,
  CheckIcon,
  PencilIcon,
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  clockIn,
  clockOut,
  completeTask,
  deleteClockSession,
} from "@/lib/actions/clock";
import {
  cancelTask,
  reopenTask,
  setTaskReminder,
  updateTask,
} from "@/lib/actions/tasks";
import {
  hasAnyClockIn,
  hasOpenSession,
  openSession,
  trackedMs,
} from "@/lib/domain/clock";
import {
  parseReminderValue,
  REMINDER_CHOICES,
} from "@/lib/domain/reminders";
import { computeDisplayStatus } from "@/lib/domain/status";
import {
  dateAtMinutes,
  formatClockDuration,
  formatDuration,
  formatHm,
  formatTimeRange,
  MINUTES_PER_DAY,
  minutesToTime,
  timeToMinutes,
} from "@/lib/domain/time";
import type { Category, TaskWithRelations } from "@/lib/domain/types";
import { ensureNotificationPermission } from "@/lib/notifications";

const SELECT_CLASS =
  "h-8 rounded-lg border border-input bg-transparent px-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-input/30";

// Latest time a native time picker accepts (23:59).
const DAY_END_MAX = MINUTES_PER_DAY - 1;

export function TaskDetailsDialog({
  task,
  categories,
  onClose,
}: {
  task: TaskWithRelations;
  categories: Category[];
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

  // Editing is allowed only before any time is recorded (no clock-ins), and
  // not for finished/cancelled tasks.
  const canEdit = !anyClockIn && !isCompleted && !isCancelled;

  // ---- Edit mode ----------------------------------------------------------
  const [editing, setEditing] = useState(false);
  const [desc, setDesc] = useState(task.description);
  const [startStr, setStartStr] = useState(formatHm(task.plannedStart));
  const [endStr, setEndStr] = useState(formatHm(task.plannedEnd));
  const [categoryId, setCategoryId] = useState(task.categoryId ?? "");
  const [editError, setEditError] = useState<string | null>(null);
  const editDurationMin = timeToMinutes(endStr) - timeToMinutes(startStr);

  function startEditing() {
    // Re-sync the form to the current task each time it opens.
    setDesc(task.description);
    setStartStr(formatHm(task.plannedStart));
    setEndStr(formatHm(task.plannedEnd));
    setCategoryId(task.categoryId ?? "");
    setEditError(null);
    setEditing(true);
  }

  function saveEdit() {
    setEditError(null);
    if (!desc.trim()) {
      setEditError("Description is required");
      return;
    }
    const startMin = timeToMinutes(startStr);
    const endMin = timeToMinutes(endStr);
    if (endMin <= startMin) {
      setEditError("End must be after start");
      return;
    }
    const startMs = dateAtMinutes(task.plannedStart, startMin).getTime();
    const endMs = dateAtMinutes(task.plannedStart, endMin).getTime();
    startTransition(async () => {
      const res = await updateTask({
        id: task.id,
        description: desc.trim(),
        categoryId: categoryId || null,
        plannedStartMs: startMs,
        plannedEndMs: endMs,
      });
      if (res.ok) {
        setEditing(false);
        router.refresh();
      } else {
        setEditError(res.error);
      }
    });
  }

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
            {canEdit && !editing && (
              <Button
                size="icon-sm"
                variant="ghost"
                aria-label="Edit task"
                disabled={pending}
                onClick={startEditing}
              >
                <PencilIcon />
              </Button>
            )}
            <StatusBadge status={status} />
          </div>
          <DialogDescription>
            {format(task.plannedStart, "EEE, MMM d")} ·{" "}
            {formatTimeRange(task.plannedStart, task.plannedEnd)}
            {task.category ? ` · ${task.category.name}` : ""}
          </DialogDescription>
        </DialogHeader>

        {editing ? (
          /* ---- Edit form ---- */
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="edit-description">Description</Label>
              <Input
                id="edit-description"
                autoFocus
                value={desc}
                onChange={(e) => setDesc(e.target.value)}
                placeholder="What are you working on?"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="edit-start">Starts</Label>
                <Input
                  id="edit-start"
                  type="time"
                  value={startStr}
                  onChange={(e) => {
                    const v = e.target.value;
                    setStartStr(v);
                    // Keep end after start.
                    if (v && timeToMinutes(endStr) <= timeToMinutes(v)) {
                      setEndStr(
                        minutesToTime(
                          Math.min(timeToMinutes(v) + 60, DAY_END_MAX),
                        ),
                      );
                    }
                  }}
                />
              </div>

              <div className="space-y-1.5">
                <Label
                  htmlFor="edit-end"
                  className="flex items-center justify-between"
                >
                  <span>Ends</span>
                  {editDurationMin > 0 && (
                    <span className="text-[11px] font-normal text-muted-foreground tabular-nums">
                      {formatDuration(editDurationMin * 60_000)}
                    </span>
                  )}
                </Label>
                <Input
                  id="edit-end"
                  type="time"
                  value={endStr}
                  onChange={(e) => setEndStr(e.target.value)}
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="edit-category">Category</Label>
              <select
                id="edit-category"
                className={`${SELECT_CLASS} w-full`}
                value={categoryId}
                onChange={(e) => setCategoryId(e.target.value)}
              >
                <option value="">No category</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>

            {editError && (
              <p className="text-xs text-destructive">{editError}</p>
            )}

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                disabled={pending}
                onClick={() => setEditing(false)}
              >
                Cancel
              </Button>
              <Button type="button" disabled={pending} onClick={saveEdit}>
                Save changes
              </Button>
            </DialogFooter>
          </div>
        ) : (
          /* ---- View mode ---- */
          <>
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

            {/* Reminder */}
            {!isCompleted && !isCancelled && (
              <div className="flex items-center justify-between gap-2">
                <Label
                  htmlFor="task-reminder"
                  className="flex items-center gap-1.5 text-sm font-medium"
                >
                  <BellIcon className="size-3.5 text-muted-foreground" />
                  Reminder
                </Label>
                <select
                  id="task-reminder"
                  className={SELECT_CLASS}
                  disabled={pending}
                  value={
                    task.notifyMinutesBefore == null
                      ? "off"
                      : String(task.notifyMinutesBefore)
                  }
                  onChange={(e) => {
                    const minutes = parseReminderValue(e.target.value);
                    if (minutes !== null) ensureNotificationPermission();
                    act(() => setTaskReminder(task.id, minutes));
                  }}
                >
                  <option value="off">No reminder</option>
                  {REMINDER_CHOICES.map((m) => (
                    <option key={m} value={m}>
                      {m} minutes before
                    </option>
                  ))}
                </select>
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
                            (s.clockOutAt ?? now).getTime() -
                              s.clockInAt.getTime(),
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
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
