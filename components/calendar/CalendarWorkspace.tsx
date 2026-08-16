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
import { ListTodoIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import {
  CreateTaskDialog,
  type CreateTaskTarget,
} from "@/components/CreateTaskDialog";
import { TaskDetailsDialog } from "@/components/TaskDetailsDialog";
import { NowProvider, useNow } from "@/components/now-context";
import { NowPanel } from "@/components/now-panel/NowPanel";
import { scheduleBacklogTask } from "@/lib/actions/backlog";
import { moveTask } from "@/lib/actions/tasks";
import { scheduledMinutes } from "@/lib/domain/backlog";
import { isDelayingDrag } from "@/lib/domain/status";
import {
  DRAG_SNAP_PX,
  durationMinutes,
  isSameDay,
  MINUTES_PER_DAY,
  minutesSinceMidnight,
  startFromOffsetPx,
} from "@/lib/domain/time";
import type {
  BacklogTask,
  Category,
  TaskWithRelations,
} from "@/lib/domain/types";
import { cn } from "@/lib/utils";
import { DayColumn } from "./DayColumn";
import { GUTTER_PX, MIN_COL_PX } from "./grid";
import { TimeGutter } from "./TimeGutter";

// Snap the vertical drag to 15-min steps (finer than the 30-min grid); leave
// horizontal free so cards can move between day columns.
const snapToSlotY: Modifier = ({ transform }) => ({
  ...transform,
  y: Math.round(transform.y / DRAG_SNAP_PX) * DRAG_SNAP_PX,
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
  backlogTasks,
  categories,
  serverNow,
}: {
  days: Date[];
  weekTasks: TaskWithRelations[];
  nowTasks: TaskWithRelations[];
  backlogTasks: BacklogTask[];
  categories: Category[];
  serverNow: number;
}) {
  const router = useRouter();
  const [tasks, setTasks] = useState(weekTasks);
  const [createTarget, setCreateTarget] = useState<CreateTaskTarget | null>(
    null,
  );
  const [detailsTaskId, setDetailsTaskId] = useState<string | null>(null);
  // Below lg the Now/Backlog panel is an overlay toggled by a floating button.
  const [panelOpen, setPanelOpen] = useState(false);
  const [, startTransition] = useTransition();

  // Re-sync to server truth whenever fresh data arrives (after router.refresh).
  // Adjusted during render (not in an effect) so the stale optimistic list is
  // never painted — React re-renders immediately with the fresh props.
  const [prevWeekTasks, setPrevWeekTasks] = useState(weekTasks);
  if (prevWeekTasks !== weekTasks) {
    setPrevWeekTasks(weekTasks);
    setTasks(weekTasks);
  }

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
  );

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over) return;

    const day = over.data.current?.day as Date | undefined;
    const translated = active.rect.current.translated;
    if (!day || !translated) return;

    // Dragged in from the backlog: give it the slot it was dropped on, sized
    // by its estimate. It has no old window, so nothing counts as a delay.
    const backlogTask = active.data.current?.backlogTask as
      | BacklogTask
      | undefined;
    if (backlogTask) {
      const minutes = scheduledMinutes(backlogTask.estimatedMinutes);
      const start = startFromOffsetPx(
        day,
        translated.top - over.rect.top,
        minutes,
      );
      startTransition(async () => {
        await scheduleBacklogTask(backlogTask.id, start.getTime());
        router.refresh();
      });
      return;
    }

    const task = tasks.find((t) => t.id === active.id);
    if (!task || task.isLocked) return;

    const durMin = durationMinutes(task.plannedStart, task.plannedEnd);
    const offsetTop = translated.top - over.rect.top;
    const newStart = startFromOffsetPx(day, offsetTop, durMin);
    if (newStart.getTime() === task.plannedStart.getTime()) return; // no-op

    const newEnd = new Date(newStart.getTime() + durMin * 60_000);
    // Only a move out to a LATER DAY counts as a delay — same-day reshuffles
    // leave the counter (and the status) alone.
    const delaying = isDelayingDrag(task.plannedStart, newStart);

    // Optimistic move (drag-delay rule mirrored client-side for instant feedback).
    setTasks((prev) =>
      prev.map((t) =>
        t.id === task.id
          ? {
              ...t,
              plannedStart: newStart,
              plannedEnd: newEnd,
              dragDelayCount: delaying ? t.dragDelayCount + 1 : t.dragDelayCount,
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

  const detailsTask = detailsTaskId
    ? (tasks.find((t) => t.id === detailsTaskId) ?? null)
    : null;

  // Duplicate: close the details view and reopen the create dialog pre-filled
  // with the task's plan, so the copy can be retimed (or made repeating).
  function duplicateTask(task: TaskWithRelations) {
    setDetailsTaskId(null);
    const endMinutes = minutesSinceMidnight(task.plannedEnd);
    setCreateTarget({
      day: task.plannedStart,
      startMinutes: minutesSinceMidnight(task.plannedStart),
      // A task ending at exactly midnight reads as minute 0 — clamp it back to
      // the end of its own day so the copy stays a valid same-day window.
      endMinutes: endMinutes === 0 ? MINUTES_PER_DAY - 1 : endMinutes,
      duplicateOf: {
        description: task.description,
        categoryId: task.categoryId,
        notifyMinutesBefore: task.notifyMinutesBefore,
      },
    });
  }

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
          <div className="relative min-w-0 flex-1 overflow-auto">
            {tasks.length === 0 && (
              <div className="pointer-events-none absolute inset-x-0 top-28 z-20 flex justify-center px-4">
                <span className="rounded-md border bg-background/90 px-3 py-2 text-sm text-muted-foreground shadow-sm">
                  No tasks this week — click any empty time slot to add one.
                </span>
              </div>
            )}
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
                  <DayColumn
                    key={i}
                    day={d}
                    tasks={tasksByDay[i]}
                    onCreate={(day, startMinutes) =>
                      setCreateTarget({ day, startMinutes })
                    }
                    onOpenDetails={setDetailsTaskId}
                  />
                ))}
              </div>
            </div>
          </div>

          {/* Backdrop for the mobile slide-over; tap to dismiss. */}
          {panelOpen && (
            <div
              className="fixed inset-0 z-40 bg-black/40 lg:hidden"
              onClick={() => setPanelOpen(false)}
              aria-hidden
            />
          )}

          {/* Inside the DndContext so backlog cards can be dragged onto the grid. */}
          <NowPanel
            tasks={nowTasks}
            backlogTasks={backlogTasks}
            categories={categories}
            mobileOpen={panelOpen}
            onMobileClose={() => setPanelOpen(false)}
          />
        </DndContext>

        {/* Floating toggle for the panel — only below lg, where it's hidden. */}
        {!panelOpen && (
          <Button
            size="icon-lg"
            className="fixed right-4 bottom-4 z-40 rounded-full shadow-lg lg:hidden"
            aria-label="Open Now panel and backlog"
            onClick={() => setPanelOpen(true)}
          >
            <ListTodoIcon />
          </Button>
        )}
      </div>

      {createTarget && (
        <CreateTaskDialog
          target={createTarget}
          categories={categories}
          onClose={() => setCreateTarget(null)}
        />
      )}

      {detailsTask && (
        <TaskDetailsDialog
          task={detailsTask}
          categories={categories}
          onClose={() => setDetailsTaskId(null)}
          onDuplicate={duplicateTask}
        />
      )}
    </NowProvider>
  );
}
