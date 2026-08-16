"use client";

import { format } from "date-fns";
import {
  AwardIcon,
  CheckIcon,
  PlayIcon,
  SquareIcon,
  XIcon,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { useNow } from "@/components/now-context";
import { StatusBadge } from "@/components/StatusBadge";
import { Button } from "@/components/ui/button";
import { clockIn, clockOut, completeTask } from "@/lib/actions/clock";
import {
  firstClockInAt,
  hasAnyClockIn,
  hasOpenSession,
  openSession,
  trackedMs,
} from "@/lib/domain/clock";
import { computeDisplayStatus, earnedOnTimeAward } from "@/lib/domain/status";
import {
  formatClockDuration,
  formatDuration,
  formatHm,
  formatTimeRange,
  isWithinPlanned,
} from "@/lib/domain/time";
import type {
  BacklogTask,
  Category,
  TaskWithRelations,
} from "@/lib/domain/types";
import { cn } from "@/lib/utils";
import { BacklogPanel } from "@/components/backlog/BacklogPanel";

export function NowPanel({
  tasks,
  backlogTasks,
  categories,
  mobileOpen = false,
  onMobileClose,
}: {
  tasks: TaskWithRelations[];
  backlogTasks: BacklogTask[];
  categories: Category[];
  // Below lg the panel is hidden by default and slides in as an overlay; from
  // lg up it is always docked and these two props are inert.
  mobileOpen?: boolean;
  onMobileClose?: () => void;
}) {
  // Own 1-second clock for live timers; initial value is hydration-safe.
  const initial = useNow();
  const [now, setNow] = useState(initial);
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  const active = tasks
    .filter((t) => isWithinPlanned(t.plannedStart, t.plannedEnd, now))
    .sort((a, b) => a.plannedStart.getTime() - b.plannedStart.getTime());

  const upcoming = tasks
    .filter(
      (t) =>
        t.status !== "COMPLETED" &&
        t.status !== "MISSED" &&
        t.plannedStart.getTime() > now.getTime(),
    )
    .sort((a, b) => a.plannedStart.getTime() - b.plannedStart.getTime())[0];

  return (
    <aside
      className={cn(
        "w-80 shrink-0 flex-col border-l bg-muted/20",
        mobileOpen
          ? // Mobile overlay: fixed slide-over on the right, docked from lg up.
            "fixed inset-y-0 right-0 z-50 flex w-[min(20rem,85vw)] bg-background shadow-2xl lg:static lg:z-auto lg:w-80 lg:bg-muted/20 lg:shadow-none"
          : "hidden lg:flex",
      )}
    >
      <div className="flex items-center justify-between border-b px-4 py-3">
        <h2 className="font-semibold">Now</h2>
        <span className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground tabular-nums">
            {format(now, "HH:mm:ss")}
          </span>
          {onMobileClose && (
            <Button
              size="icon-sm"
              variant="ghost"
              className="lg:hidden"
              aria-label="Close panel"
              onClick={onMobileClose}
            >
              <XIcon />
            </Button>
          )}
        </span>
      </div>

      <div className="min-h-0 flex-1 space-y-3 overflow-auto p-3">
        {active.length === 0 ? (
          <div className="rounded-lg border border-dashed p-4 text-center text-sm text-muted-foreground">
            <p>Nothing scheduled right now.</p>
            {upcoming && (
              <p className="mt-2">
                Next:{" "}
                <span className="font-medium text-foreground">
                  {upcoming.description}
                </span>{" "}
                at {formatHm(upcoming.plannedStart)}
              </p>
            )}
          </div>
        ) : (
          active.map((task) => (
            <NowTaskCard key={task.id} task={task} now={now} />
          ))
        )}
      </div>

      <BacklogPanel tasks={backlogTasks} categories={categories} />
    </aside>
  );
}

function NowTaskCard({ task, now }: { task: TaskWithRelations; now: Date }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const sessions = task.clockSessions;
  const open = hasOpenSession(sessions);
  const anyClockIn = hasAnyClockIn(sessions);
  const status = computeDisplayStatus(task, now, anyClockIn, open);
  const total = trackedMs(sessions, now);
  const running = openSession(sessions);
  const runningMs = running ? now.getTime() - running.clockInAt.getTime() : 0;
  const accent = task.category?.color ?? "var(--muted-foreground)";
  const completed = task.status === "COMPLETED";
  const missed = task.status === "MISSED";
  // Same criterion as the calendar card and details dialog (earnedOnTimeAward):
  // started within the grace window AND finished before the planned end.
  const awarded = earnedOnTimeAward(task, firstClockInAt(sessions));

  const run = (fn: (id: string) => Promise<unknown>) =>
    startTransition(async () => {
      await fn(task.id);
      router.refresh();
    });

  return (
    <div
      className={cn(
        "rounded-lg border p-3 shadow-sm",
        completed
          ? "border-emerald-300 bg-emerald-100 ring-1 ring-emerald-300 dark:border-emerald-800/70 dark:bg-emerald-950/60 dark:ring-emerald-800"
          : missed
            ? "border-rose-300 bg-rose-50 ring-1 ring-rose-300 dark:border-rose-900/70 dark:bg-rose-950/40 dark:ring-rose-900"
            : status === "RUNNING"
              ? "animate-running bg-card ring-2 ring-emerald-400 dark:ring-emerald-500"
              : "bg-card ring-2 ring-primary/15",
      )}
      style={{ borderLeftColor: accent, borderLeftWidth: 4 }}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs text-muted-foreground tabular-nums">
          {formatTimeRange(task.plannedStart, task.plannedEnd)}
        </span>
        <span className="flex items-center gap-1.5">
          {awarded && <AwardIcon className="size-4 text-amber-500" />}
          <StatusBadge status={status} />
        </span>
      </div>

      <p className="mt-1 font-medium">{task.description}</p>

      <div className="mt-2 flex items-center justify-between text-sm">
        <span className="text-muted-foreground">Tracked</span>
        <span className="font-semibold tabular-nums">
          {formatDuration(total)}
        </span>
      </div>
      {open && (
        <div className="mt-1 flex items-center justify-end gap-1.5 text-sm text-emerald-600 dark:text-emerald-400">
          <span className="size-2 animate-pulse rounded-full bg-emerald-500" />
          <span className="tabular-nums">{formatClockDuration(runningMs)}</span>
        </div>
      )}

      {!completed && !missed && (
        <div className="mt-3 flex gap-2">
          {open ? (
            <Button
              size="sm"
              variant="outline"
              disabled={pending}
              onClick={() => run(clockOut)}
            >
              <SquareIcon />
              Clock out
            </Button>
          ) : (
            <Button size="sm" disabled={pending} onClick={() => run(clockIn)}>
              <PlayIcon />
              Clock in
            </Button>
          )}
          {/* Available with or without a clock-in; only an open session blocks it. */}
          {!open && (
            <Button
              size="sm"
              variant="secondary"
              disabled={pending}
              onClick={() => run(completeTask)}
            >
              <CheckIcon />
              Complete
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
