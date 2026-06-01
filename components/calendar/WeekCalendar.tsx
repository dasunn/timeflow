"use client";

import { format } from "date-fns";
import { NowProvider, useNow } from "@/components/now-context";
import { isSameDay } from "@/lib/domain/time";
import type { TaskWithRelations } from "@/lib/domain/types";
import { cn } from "@/lib/utils";
import { DayColumn } from "./DayColumn";
import { GUTTER_PX, MIN_COL_PX } from "./grid";
import { TimeGutter } from "./TimeGutter";

function DayHeader({ day }: { day: Date }) {
  const now = useNow();
  const today = isSameDay(day, now);
  return (
    <div
      className="flex-1 border-l border-border px-2 py-2 text-center"
      style={{ minWidth: MIN_COL_PX }}
    >
      <div className="text-[11px] font-medium tracking-wide text-muted-foreground uppercase">
        {format(day, "EEE")}
      </div>
      <div
        className={cn(
          "mx-auto mt-0.5 flex size-7 items-center justify-center rounded-full text-sm font-semibold",
          today && "bg-primary text-primary-foreground",
        )}
      >
        {format(day, "d")}
      </div>
    </div>
  );
}

export function WeekCalendar({
  days,
  tasks,
  serverNow,
}: {
  days: Date[];
  tasks: TaskWithRelations[];
  serverNow: number;
}) {
  const tasksByDay = days.map((d) =>
    tasks.filter((t) => isSameDay(t.plannedStart, d)),
  );

  return (
    <NowProvider initial={serverNow}>
      <div className="min-w-0 flex-1 overflow-auto">
        <div
          className="w-full"
          style={{ minWidth: GUTTER_PX + 7 * MIN_COL_PX }}
        >
          {/* Sticky day headers */}
          <div className="sticky top-0 z-30 flex border-b bg-background/95 backdrop-blur">
            <div
              className="sticky left-0 z-40 shrink-0 bg-background"
              style={{ width: GUTTER_PX }}
            />
            {days.map((d, i) => (
              <DayHeader key={i} day={d} />
            ))}
          </div>

          {/* Grid body */}
          <div className="flex">
            <TimeGutter />
            {days.map((d, i) => (
              <DayColumn key={i} day={d} tasks={tasksByDay[i]} />
            ))}
          </div>
        </div>
      </div>
    </NowProvider>
  );
}
