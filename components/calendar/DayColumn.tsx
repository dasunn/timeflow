"use client";

import { useDroppable } from "@dnd-kit/core";
import { useNow } from "@/components/now-context";
import {
  DAY_HEIGHT_PX,
  isSameDay,
  MINUTES_PER_DAY,
  SLOT_HEIGHT_PX,
  SLOT_MINUTES,
  topPx,
} from "@/lib/domain/time";
import type { TaskWithRelations } from "@/lib/domain/types";
import { cn } from "@/lib/utils";
import { slotLinesStyle, MIN_COL_PX } from "./grid";
import { layoutDayTasks } from "./layout";
import { TaskCard } from "./TaskCard";

export function DayColumn({
  day,
  tasks,
  onCreate,
  onOpenDetails,
}: {
  day: Date;
  tasks: TaskWithRelations[];
  onCreate: (day: Date, startMinutes: number) => void;
  onOpenDetails: (taskId: string) => void;
}) {
  const now = useNow();
  const laid = layoutDayTasks(tasks);
  const isToday = isSameDay(day, now);

  const { setNodeRef, isOver } = useDroppable({
    id: `day-${day.getTime()}`,
    data: { day },
  });

  // Click on empty grid (not a card) -> start creating at the clicked slot.
  function handleClick(e: React.MouseEvent<HTMLDivElement>) {
    if (e.target !== e.currentTarget) return;
    const y = e.clientY - e.currentTarget.getBoundingClientRect().top;
    const minutes = Math.max(
      0,
      Math.min(
        Math.floor(y / SLOT_HEIGHT_PX) * SLOT_MINUTES,
        MINUTES_PER_DAY - SLOT_MINUTES,
      ),
    );
    onCreate(day, minutes);
  }

  return (
    <div
      ref={setNodeRef}
      onClick={handleClick}
      className={cn(
        "relative flex-1 border-l border-border",
        isOver && "bg-accent/40",
      )}
      style={{ height: DAY_HEIGHT_PX, minWidth: MIN_COL_PX, ...slotLinesStyle }}
    >
      {laid.map((item) => (
        <TaskCard key={item.task.id} {...item} onOpenDetails={onOpenDetails} />
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
