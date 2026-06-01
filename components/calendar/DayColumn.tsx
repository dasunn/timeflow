"use client";

import { useDroppable } from "@dnd-kit/core";
import { useNow } from "@/components/now-context";
import { DAY_HEIGHT_PX, isSameDay, topPx } from "@/lib/domain/time";
import type { TaskWithRelations } from "@/lib/domain/types";
import { cn } from "@/lib/utils";
import { slotLinesStyle, MIN_COL_PX } from "./grid";
import { layoutDayTasks } from "./layout";
import { TaskCard } from "./TaskCard";

export function DayColumn({
  day,
  tasks,
}: {
  day: Date;
  tasks: TaskWithRelations[];
}) {
  const now = useNow();
  const laid = layoutDayTasks(tasks);
  const isToday = isSameDay(day, now);

  const { setNodeRef, isOver } = useDroppable({
    id: `day-${day.getTime()}`,
    data: { day },
  });

  return (
    <div
      ref={setNodeRef}
      className={cn(
        "relative flex-1 border-l border-border",
        isOver && "bg-accent/40",
      )}
      style={{ height: DAY_HEIGHT_PX, minWidth: MIN_COL_PX, ...slotLinesStyle }}
    >
      {laid.map((item) => (
        <TaskCard key={item.task.id} {...item} />
      ))}

      {isToday && (
        <div
          className="pointer-events-none absolute inset-x-0 z-10 flex items-center"
          style={{ top: topPx(now) }}
        >
          <div className="size-2 -translate-x-1/2 rounded-full bg-red-500" />
          <div className="h-px flex-1 bg-red-500/70" />
        </div>
      )}
    </div>
  );
}
