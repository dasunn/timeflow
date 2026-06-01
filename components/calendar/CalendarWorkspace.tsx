"use client";

import {
  DndContext,
  PointerSensor,
  pointerWithin,
  useSensor,
  useSensors,
  type DragEndEvent,
  type Modifier,
} from "@dnd-kit/core";
import { restrictToWindowEdges } from "@dnd-kit/modifiers";
import { format } from "date-fns";
import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { NowProvider, useNow } from "@/components/now-context";
import { NowPanel } from "@/components/now-panel/NowPanel";
import { moveTask } from "@/lib/actions/tasks";
import {
  durationMinutes,
  isSameDay,
  SLOT_HEIGHT_PX,
  startFromOffsetPx,
} from "@/lib/domain/time";
import type { TaskWithRelations } from "@/lib/domain/types";
import { cn } from "@/lib/utils";
import { DayColumn } from "./DayColumn";
import { GUTTER_PX, MIN_COL_PX } from "./grid";
import { TimeGutter } from "./TimeGutter";

// Snap the vertical drag to the 30-min grid; leave horizontal free so cards
// can move between day columns.
const snapToSlotY: Modifier = ({ transform }) => ({
  ...transform,
  y: Math.round(transform.y / SLOT_HEIGHT_PX) * SLOT_HEIGHT_PX,
});

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

export function CalendarWorkspace({
  days,
  weekTasks,
  nowTasks,
  serverNow,
}: {
  days: Date[];
  weekTasks: TaskWithRelations[];
  nowTasks: TaskWithRelations[];
  serverNow: number;
}) {
  const router = useRouter();
  const [tasks, setTasks] = useState(weekTasks);
  const [, startTransition] = useTransition();

  // Re-sync to server truth whenever fresh data arrives (after router.refresh).
  useEffect(() => setTasks(weekTasks), [weekTasks]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
  );

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over) return;

    const day = over.data.current?.day as Date | undefined;
    const translated = active.rect.current.translated;
    const task = tasks.find((t) => t.id === active.id);
    if (!day || !translated || !task || task.isLocked) return;

    const durMin = durationMinutes(task.plannedStart, task.plannedEnd);
    const offsetTop = translated.top - over.rect.top;
    const newStart = startFromOffsetPx(day, offsetTop, durMin);
    if (newStart.getTime() === task.plannedStart.getTime()) return; // no-op

    const newEnd = new Date(newStart.getTime() + durMin * 60_000);
    const later = newStart.getTime() > task.plannedStart.getTime();

    // Optimistic move (drag-delay rule mirrored client-side for instant feedback).
    setTasks((prev) =>
      prev.map((t) =>
        t.id === task.id
          ? {
              ...t,
              plannedStart: newStart,
              plannedEnd: newEnd,
              dragDelayCount: later ? t.dragDelayCount + 1 : t.dragDelayCount,
            }
          : t,
      ),
    );

    startTransition(async () => {
      await moveTask(task.id, newStart.getTime(), newEnd.getTime());
      router.refresh();
    });
  }

  const tasksByDay = days.map((d) =>
    tasks.filter((t) => isSameDay(t.plannedStart, d)),
  );

  return (
    <NowProvider initial={serverNow}>
      <div className="flex min-h-0 flex-1">
        <DndContext
          id="timeflow-calendar"
          sensors={sensors}
          collisionDetection={pointerWithin}
          modifiers={[snapToSlotY, restrictToWindowEdges]}
          onDragEnd={handleDragEnd}
        >
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
        </DndContext>

        <NowPanel tasks={nowTasks} />
      </div>
    </NowProvider>
  );
}
