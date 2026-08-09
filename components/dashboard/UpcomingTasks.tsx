"use client";

import { format, isToday, isTomorrow } from "date-fns";
import { BellIcon, CalendarClockIcon } from "lucide-react";
import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  durationMinutes,
  formatCountdown,
  formatDuration,
  formatTimeRange,
} from "@/lib/domain/time";
import type { TaskWithRelations } from "@/lib/domain/types";
import { cn } from "@/lib/utils";

// Matches the donut chart's uncategorized swatch. A literal hex (not a CSS
// var) because the tints below build colors by string concatenation.
const UNCATEGORIZED_COLOR = "#94a3b8";

// The approach meter fills over the final day before a task starts; anything
// further out sits at the low end of the bar.
const APPROACH_HORIZON_MS = 24 * 60 * 60 * 1000;

function dayLabel(date: Date): string {
  if (isToday(date)) return "Today";
  if (isTomorrow(date)) return "Tomorrow";
  return format(date, "EEE, MMM d");
}

export function UpcomingTasks({
  tasks,
  serverNow,
}: {
  tasks: TaskWithRelations[];
  serverNow: number;
}) {
  // Seeded from the server clock so the first paint matches the server HTML,
  // then ticks on its own. A minute is plenty — the copy is minute-grained.
  const [now, setNow] = useState(() => new Date(serverNow));
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 30_000);
    return () => clearInterval(id);
  }, []);

  if (tasks.length === 0) {
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

  const [next, ...rest] = tasks;

  return (
    <Card className="h-full">
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="flex items-center gap-2">
          <CalendarClockIcon className="size-4 text-muted-foreground" />
          Up next
        </CardTitle>
        <span className="rounded-full bg-secondary px-2 py-0.5 text-xs font-medium text-secondary-foreground">
          {tasks.length} scheduled
        </span>
      </CardHeader>

      <CardContent className="space-y-4">
        <HeroTask task={next} now={now} />
        {rest.length > 0 && <Timeline tasks={rest} now={now} />}
      </CardContent>
    </Card>
  );
}

function HeroTask({ task, now }: { task: TaskWithRelations; now: Date }) {
  const color = task.category?.color ?? UNCATEGORIZED_COLOR;
  const untilMs = task.plannedStart.getTime() - now.getTime();
  const approachPct =
    100 * (1 - Math.min(1, Math.max(0, untilMs) / APPROACH_HORIZON_MS));
  const imminent = untilMs <= 15 * 60 * 1000;

  return (
    <div
      className="relative overflow-hidden rounded-xl border p-4"
      style={{
        borderLeftColor: color,
        borderLeftWidth: 5,
        background: `linear-gradient(100deg, ${color}1f, transparent 65%)`,
      }}
    >
      <div className="flex items-start justify-between gap-3">
        <span
          className="rounded-full px-2 py-0.5 text-[10px] font-semibold tracking-widest text-white uppercase"
          style={{ backgroundColor: color }}
        >
          Next up
        </span>
        <span className="text-right">
          <span
            className={cn(
              "block text-2xl leading-none font-bold tabular-nums",
              imminent && "text-red-600 dark:text-red-400",
            )}
          >
            {formatCountdown(untilMs)}
          </span>
          <span className="text-[10px] tracking-wide text-muted-foreground uppercase">
            from now
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
      </div>

      {/* Approach meter — fills as the start time closes in. */}
      <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-muted">
        <div
          className="h-full rounded-full transition-[width] duration-500"
          style={{ width: `${approachPct}%`, backgroundColor: color }}
        />
      </div>
    </div>
  );
}

function Timeline({ tasks, now }: { tasks: TaskWithRelations[]; now: Date }) {
  // Duration bars are scaled against the longest task shown, so the row
  // widths read as a relative comparison rather than absolute minutes.
  const longestMin = Math.max(
    ...tasks.map((t) => durationMinutes(t.plannedStart, t.plannedEnd)),
    1,
  );

  return (
    <ol className="relative space-y-3 border-l pl-5">
      {tasks.map((task) => {
        const color = task.category?.color ?? UNCATEGORIZED_COLOR;
        const durMin = durationMinutes(task.plannedStart, task.plannedEnd);
        return (
          <li key={task.id} className="relative">
            <span
              className="absolute top-1.5 -left-[27px] size-2.5 rounded-full ring-4 ring-card"
              style={{ backgroundColor: color }}
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
              <span className="shrink-0 text-xs font-medium text-muted-foreground tabular-nums">
                in {formatCountdown(task.plannedStart.getTime() - now.getTime())}
              </span>
            </div>
            <div className="mt-1.5 h-1 w-full overflow-hidden rounded-full bg-muted">
              <div
                className="h-full rounded-full opacity-70"
                style={{
                  width: `${(durMin / longestMin) * 100}%`,
                  backgroundColor: color,
                }}
              />
            </div>
          </li>
        );
      })}
    </ol>
  );
}
