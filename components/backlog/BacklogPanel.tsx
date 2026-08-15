"use client";

import { useDraggable } from "@dnd-kit/core";
import { GripVerticalIcon, PlusIcon, Trash2Icon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createBacklogTask, deleteBacklogTask } from "@/lib/actions/backlog";
import {
  DEFAULT_ESTIMATE_MINUTES,
  ESTIMATE_CHOICES,
  formatEstimate,
  scheduledMinutes,
} from "@/lib/domain/backlog";
import type { BacklogTask, Category } from "@/lib/domain/types";
import { cn } from "@/lib/utils";

const SELECT_CLASS =
  "h-8 w-full rounded-lg border border-input bg-transparent px-2 text-xs outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-input/30";

// Tasks with no slot yet. Dragging one onto a day column schedules it (see
// CalendarWorkspace.handleDragEnd) — there's no repeat here, since a repeat
// needs dates to repeat on.
export function BacklogPanel({
  tasks,
  categories,
}: {
  tasks: BacklogTask[];
  categories: Category[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [adding, setAdding] = useState(false);
  const [description, setDescription] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [estimate, setEstimate] = useState<number>(DEFAULT_ESTIMATE_MINUTES);
  const [error, setError] = useState<string | null>(null);

  function openForm() {
    setDescription("");
    setError(null);
    setAdding(true);
  }

  function save() {
    if (!description.trim()) {
      setError("Description is required");
      return;
    }
    setError(null);
    startTransition(async () => {
      const res = await createBacklogTask({
        description: description.trim(),
        categoryId: categoryId || null,
        estimatedMinutes: estimate,
      });
      if (res.ok) {
        // Stay open with the settings kept — parking several in a row is the
        // normal way this list gets filled.
        setDescription("");
        router.refresh();
      } else {
        setError(res.error);
      }
    });
  }

  return (
    <section className="flex max-h-[55%] min-h-0 shrink-0 flex-col border-t">
      <div className="flex items-center justify-between gap-2 border-b px-4 py-3">
        <h2 className="flex items-center gap-2 font-semibold">
          Backlog
          {tasks.length > 0 && (
            <span className="rounded-full bg-muted px-1.5 text-xs font-medium text-muted-foreground tabular-nums">
              {tasks.length}
            </span>
          )}
        </h2>
        <Button
          size="icon-sm"
          variant="ghost"
          aria-label="Add backlog task"
          title="Add backlog task"
          disabled={pending}
          onClick={() => (adding ? setAdding(false) : openForm())}
        >
          <PlusIcon />
        </Button>
      </div>

      <div className="min-h-0 flex-1 space-y-2 overflow-auto p-3">
        {adding && (
          <div className="space-y-2 rounded-lg border border-dashed p-2.5">
            <Input
              autoFocus
              className="h-8 text-xs"
              placeholder="What needs doing?"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  save();
                }
              }}
            />

            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <Label
                  htmlFor="backlog-category"
                  className="text-xs text-muted-foreground"
                >
                  Category
                </Label>
                <select
                  id="backlog-category"
                  className={SELECT_CLASS}
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

              <div className="space-y-1">
                <Label
                  htmlFor="backlog-estimate"
                  className="text-xs text-muted-foreground"
                >
                  How long?
                </Label>
                <select
                  id="backlog-estimate"
                  className={SELECT_CLASS}
                  value={estimate}
                  onChange={(e) => setEstimate(Number(e.target.value))}
                >
                  {ESTIMATE_CHOICES.map((m) => (
                    <option key={m} value={m}>
                      {formatEstimate(m)}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {error && <p className="text-xs text-destructive">{error}</p>}

            <div className="flex justify-end gap-2">
              <Button
                size="sm"
                variant="outline"
                disabled={pending}
                onClick={() => setAdding(false)}
              >
                Done
              </Button>
              <Button size="sm" disabled={pending} onClick={save}>
                Add to backlog
              </Button>
            </div>
          </div>
        )}

        {tasks.length === 0 ? (
          !adding && (
            <div className="rounded-lg border border-dashed p-4 text-center text-sm text-muted-foreground">
              Nothing parked. Add a task without a time here, then drag it onto
              the calendar when you know when to do it.
            </div>
          )
        ) : (
          <>
            {tasks.map((task) => (
              <BacklogChip key={task.id} task={task} disabled={pending} />
            ))}
            <p className="px-1 pt-1 text-[11px] text-muted-foreground">
              Drag a card onto the calendar to schedule it.
            </p>
          </>
        )}
      </div>
    </section>
  );
}

function BacklogChip({
  task,
  disabled,
}: {
  task: BacklogTask;
  disabled: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const { attributes, listeners, setNodeRef, transform, isDragging } =
    useDraggable({ id: task.id, data: { backlogTask: task } });

  const accent = task.category?.color ?? "var(--muted-foreground)";

  return (
    <div
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      className={cn(
        "flex cursor-grab items-center gap-2 rounded-lg border bg-card px-2 py-1.5 text-xs shadow-sm outline-none",
        isDragging && "z-50 cursor-grabbing shadow-lg ring-2 ring-ring",
        pending && "opacity-50",
      )}
      style={{
        borderLeftColor: accent,
        borderLeftWidth: 4,
        touchAction: "none",
        transform: transform
          ? `translate3d(${transform.x}px, ${transform.y}px, 0)`
          : undefined,
      }}
    >
      <GripVerticalIcon className="size-3.5 shrink-0 text-muted-foreground" />
      <span className="min-w-0 flex-1 truncate font-medium">
        {task.description}
      </span>
      <span className="shrink-0 text-[10px] text-muted-foreground tabular-nums">
        {formatEstimate(scheduledMinutes(task.estimatedMinutes))}
      </span>
      <Button
        size="icon-xs"
        variant="ghost"
        aria-label={`Delete ${task.description}`}
        disabled={disabled || pending}
        // Keep the press off the drag sensor so a delete never starts a drag.
        onPointerDown={(e) => e.stopPropagation()}
        onClick={() =>
          startTransition(async () => {
            await deleteBacklogTask(task.id);
            router.refresh();
          })
        }
      >
        <Trash2Icon />
      </Button>
    </div>
  );
}
