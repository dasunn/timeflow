"use client";

import { format, isToday, isTomorrow } from "date-fns";
import {
  BellIcon,
  CalendarClockIcon,
  CircleDotIcon,
  PauseIcon,
  TriangleAlertIcon,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { SwipeToStart } from "@/components/dashboard/SwipeToStart";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { clockIn, clockOut } from "@/lib/actions/clock";
import { hasAnyClockIn, hasOpenSession, trackedMs } from "@/lib/domain/clock";
import { computeDisplayStatus } from "@/lib/domain/status";
import {
  durationMinutes,
  formatClockDuration,
  formatCountdown,
  formatDuration,
  formatTimeRange,
} from "@/lib/domain/time";
import type { TaskStatus, TaskWithRelations } from "@/lib/domain/types";
import { cn } from "@/lib/utils";

// Matches the donut chart's uncategorized swatch. A literal hex (not a CSS
// var) because the tints below build colors by string concatenation.
const UNCATEGORIZED_COLOR = "#94a3b8";

function dayLabel(date: Date): string {
  if (isToday(date)) return "Today";
  if (isTomorrow(date)) return "Tomorrow";
  return format(date, "EEE, MMM d");
}

// How far through its planned window a task is, 0–1. This is the one meaning
// the bars on this card carry: nothing before the start, full at the end.
function elapsedFraction(task: TaskWithRelations, now: Date): number {
  const span = task.plannedEnd.getTime() - task.plannedStart.getTime();
  if (span <= 0) return now >= task.plannedEnd ? 1 : 0;
  const done = (now.getTime() - task.plannedStart.getTime()) / span;
  return Math.min(1, Math.max(0, done));
}

export function UpcomingTasks({
  tasks,
  serverNow,
}: {
  tasks: TaskWithRelations[];
  serverNow: number;
}) {
  // Seeded from the server clock so the first paint matches the server HTML,
  // then ticks on its own. Every second, not every minute: the progress bar and
  // the running timer are both second-grained now.
  const [now, setNow] = useState(() => new Date(serverNow));
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  // The server query keeps a task until its planned END, so a task in progress
  // stays on the card instead of vanishing the moment it begins. Re-applying
  // that bound here retires it live, without waiting for a refresh.
  const live = tasks.filter((t) => t.plannedEnd.getTime() > now.getTime());

  if (live.length === 0) {
    return (
      <Card className="h-full">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CalendarClockIcon className="size-4 text-muted-foreground" />
            Up next
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Nothing scheduled ahead — the calendar is clear.
          </p>
        </CardContent>
      </Card>
    );
  }

  const [next, ...rest] = live;

  return (
    <Card className="h-full">
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="flex items-center gap-2">
          <CalendarClockIcon className="size-4 text-muted-foreground" />
          Up next
        </CardTitle>
        <span className="rounded-full bg-secondary px-2 py-0.5 text-xs font-medium text-secondary-foreground">
          {live.length} scheduled
        </span>
      </CardHeader>

      <CardContent className="space-y-4">
        <HeroTask task={next} now={now} />
        {rest.length > 0 && <Timeline tasks={rest} now={now} />}
      </CardContent>
    </Card>
  );
}

// Chip copy per derived status. PENDING is the one that earns the red flash:
// the start time has passed and the task was never begun.
const STATE_CHIP: Partial<
  Record<TaskStatus, { text: string; icon: typeof CircleDotIcon }>
> = {
  RUNNING: { text: "Running", icon: CircleDotIcon },
  PAUSED: { text: "Paused", icon: PauseIcon },
  PENDING: { text: "Not started", icon: TriangleAlertIcon },
};

function HeroTask({ task, now }: { task: TaskWithRelations; now: Date }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const color = task.category?.color ?? UNCATEGORIZED_COLOR;
  const sessions = task.clockSessions;
  const running = hasOpenSession(sessions);
  const status = computeDisplayStatus(
    task,
    now,
    hasAnyClockIn(sessions),
    running,
  );

  const started = now.getTime() >= task.plannedStart.getTime();
  const untilMs = task.plannedStart.getTime() - now.getTime();
  const leftMs = task.plannedEnd.getTime() - now.getTime();
  const progress = elapsedFraction(task, now);
  const tracked = trackedMs(sessions, now);

  const chip = STATE_CHIP[status];
  const ChipIcon = chip?.icon;

  function act(fn: (id: string) => Promise<unknown>) {
    startTransition(async () => {
      await fn(task.id);
      router.refresh();
    });
  }

  return (
    <div
      className={cn(
        "relative isolate overflow-hidden rounded-xl border p-4",
        status === "PENDING" && "border-red-400/70 dark:border-red-500/60",
      )}
      style={{
        // Every animation layer below tints itself from this one value.
        ["--task-color" as string]: color,
        borderLeftColor: color,
        borderLeftWidth: 5,
        background: `linear-gradient(100deg, ${color}1f, transparent 65%)`,
      }}
    >
      {/* RUNNING — abstract waves in the task's own colour, behind the text. */}
      {status === "RUNNING" && (
        <div className="task-waves -z-10" aria-hidden>
          <span className="task-wave" />
          <span className="task-wave" />
          <span className="task-wave" />
          <span className="task-scan" />
        </div>
      )}

      {/* PENDING — red flash. Kept on its own layer so it doesn't fight the
          category gradient painted on the card itself. */}
      {status === "PENDING" && (
        <div className="task-pending-flash -z-10" aria-hidden />
      )}

      <div className="flex items-start justify-between gap-3">
        <span
          className={cn(
            "flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold tracking-widest text-white uppercase",
            status === "PENDING" && "bg-red-600",
          )}
          style={
            status === "PENDING" ? undefined : { backgroundColor: color }
          }
        >
          {ChipIcon && <ChipIcon className="size-3" />}
          {chip?.text ?? "Next up"}
        </span>

        <span className="text-right">
          <span
            className={cn(
              "block text-2xl leading-none font-bold tabular-nums",
              !started && untilMs <= 15 * 60 * 1000 && "text-red-600 dark:text-red-400",
              status === "PENDING" && "text-red-600 dark:text-red-400",
            )}
          >
            {started ? formatCountdown(leftMs) : formatCountdown(untilMs)}
          </span>
          <span className="text-[10px] tracking-wide text-muted-foreground uppercase">
            {started ? "left" : "from now"}
          </span>
        </span>
      </div>

      <p className="mt-3 text-lg leading-snug font-semibold">
        {task.description}
      </p>

      <div className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
        <span className="font-medium text-foreground">
          {dayLabel(task.plannedStart)}
        </span>
        <span aria-hidden>·</span>
        <span className="tabular-nums">
          {formatTimeRange(task.plannedStart, task.plannedEnd)}
        </span>
        <span aria-hidden>·</span>
        <span>
          {formatDuration(
            durationMinutes(task.plannedStart, task.plannedEnd) * 60_000,
          )}
        </span>
        {task.category && (
          <span className="flex items-center gap-1">
            <span aria-hidden>·</span>
            <span
              className="size-2 rounded-full"
              style={{ backgroundColor: color }}
            />
            {task.category.name}
          </span>
        )}
        {task.notifyMinutesBefore !== null && (
          <span className="flex items-center gap-1">
            <span aria-hidden>·</span>
            <BellIcon className="size-3" />
            {task.notifyMinutesBefore}m before
          </span>
        )}
        {tracked > 0 && (
          <span className="flex items-center gap-1 font-medium text-foreground">
            <span aria-hidden>·</span>
            {running ? (
              <span className="size-2 animate-pulse rounded-full bg-emerald-500" />
            ) : null}
            <span className="tabular-nums">
              {running ? formatClockDuration(tracked) : formatDuration(tracked)}{" "}
              tracked
            </span>
          </span>
        )}
      </div>

      <ProgressLine
        color={color}
        progress={progress}
        live={status === "RUNNING"}
        danger={status === "PENDING"}
        className="mt-3 h-1.5"
      />

      {/* Clock in / out, as a swipe rather than a button — a deliberate gesture
          for an action that writes a timestamp. Keyed on the running flag so
          the control remounts (and drops its busy state) once the server
          round-trip lands. */}
      <SwipeToStart
        key={`${task.id}-${running}`}
        color={color}
        disabled={pending}
        label={
          running
            ? "Swipe to stop"
            : status === "PAUSED"
              ? "Swipe to resume"
              : "Swipe to start"
        }
        busyLabel={running ? "Stopping…" : "Starting…"}
        onConfirm={() => act(running ? clockOut : clockIn)}
      />
    </div>
  );
}

// The one bar shape on this card. `progress` is always elapsed-through-window;
// `live` adds the moving sheen that marks a clock actually running.
function ProgressLine({
  color,
  progress,
  live = false,
  danger = false,
  className,
}: {
  color: string;
  progress: number;
  live?: boolean;
  danger?: boolean;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "relative w-full overflow-hidden rounded-full bg-muted",
        className,
      )}
    >
      <div
        className="h-full rounded-full transition-[width] duration-1000 ease-linear"
        style={{
          width: `${progress * 100}%`,
          backgroundColor: danger ? "rgb(239 68 68)" : color,
        }}
      />
      {live && progress > 0 && (
        <div
          className="task-scan"
          aria-hidden
          style={{ width: "40%", opacity: 0.8 }}
        />
      )}
    </div>
  );
}

function Timeline({ tasks, now }: { tasks: TaskWithRelations[]; now: Date }) {
  return (
    <ol className="relative space-y-3 border-l pl-5">
      {tasks.map((task) => {
        const color = task.category?.color ?? UNCATEGORIZED_COLOR;
        const sessions = task.clockSessions;
        const status = computeDisplayStatus(
          task,
          now,
          hasAnyClockIn(sessions),
          hasOpenSession(sessions),
        );
        const started = now.getTime() >= task.plannedStart.getTime();
        return (
          <li key={task.id} className="relative">
            <span
              className={cn(
                "absolute top-1.5 -left-[27px] size-2.5 rounded-full ring-4 ring-card",
                status === "RUNNING" && "animate-pulse",
              )}
              style={{
                backgroundColor:
                  status === "PENDING" ? "rgb(239 68 68)" : color,
              }}
            />
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="truncate text-sm font-medium">
                  {task.description}
                </p>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  <span className="font-medium">
                    {dayLabel(task.plannedStart)}
                  </span>{" "}
                  <span className="tabular-nums">
                    {formatTimeRange(task.plannedStart, task.plannedEnd)}
                  </span>
                </p>
              </div>
              <span
                className={cn(
                  "shrink-0 text-xs font-medium text-muted-foreground tabular-nums",
                  status === "PENDING" && "text-red-600 dark:text-red-400",
                )}
              >
                {started
                  ? `${formatCountdown(task.plannedEnd.getTime() - now.getTime())} left`
                  : `in ${formatCountdown(task.plannedStart.getTime() - now.getTime())}`}
              </span>
            </div>
            {/* Same meaning as the hero's bar: elapsed through the planned
                window, so a row that hasn't started reads as empty. */}
            <ProgressLine
              color={color}
              progress={elapsedFraction(task, now)}
              live={status === "RUNNING"}
              danger={status === "PENDING"}
              className="mt-1.5 h-1"
            />
          </li>
        );
      })}
    </ol>
  );
}
