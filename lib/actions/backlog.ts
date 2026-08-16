"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { scheduledMinutes } from "@/lib/domain/backlog";
import { backlogTaskSchema } from "@/lib/domain/validation";
import type { ActionResult } from "@/lib/actions/tasks";

// Park a task with no calendar slot. The planned window is a zero-length
// placeholder at the moment of creation: it is never read while isBacklog is
// true, and every scheduled query filters these rows out.
export async function createBacklogTask(input: {
  description: string;
  categoryId: string | null;
  estimatedMinutes: number | null;
}): Promise<ActionResult> {
  const parsed = backlogTaskSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "Invalid task",
    };
  }

  const placeholder = new Date();
  await prisma.task.create({
    data: {
      description: parsed.data.description,
      categoryId: parsed.data.categoryId ?? null,
      estimatedMinutes: parsed.data.estimatedMinutes ?? null,
      isBacklog: true,
      plannedStart: placeholder,
      plannedEnd: placeholder,
    },
  });

  revalidatePath("/");
  return { ok: true };
}

// Drop a backlog task onto the calendar: it gets a real planned window and
// becomes an ordinary task. `startMs` is where it was dropped; the length comes
// from its estimate, so the caller doesn't get to invent a duration. Neither
// delay counter is touched — an unscheduled task can't have slipped.
export async function scheduleBacklogTask(
  taskId: string,
  startMs: number,
): Promise<ActionResult> {
  const task = await prisma.task.findUnique({ where: { id: taskId } });
  if (!task) return { ok: false, error: "Task not found" };
  if (!task.isBacklog) return { ok: false, error: "Task is already scheduled" };

  const start = new Date(startMs);
  if (Number.isNaN(start.getTime())) {
    return { ok: false, error: "Invalid drop position" };
  }
  const minutes = scheduledMinutes(task.estimatedMinutes);

  await prisma.task.update({
    where: { id: taskId },
    data: {
      isBacklog: false,
      plannedStart: start,
      plannedEnd: new Date(start.getTime() + minutes * 60_000),
    },
  });

  revalidatePath("/");
  return { ok: true };
}

// Remove a parked task for good. Only ever deletes backlog rows: a parked task
// has no slot, so it can be dropped at any time. Scheduled work goes through
// deleteTask, which only lets go of a task that hasn't reached its start yet.
export async function deleteBacklogTask(taskId: string): Promise<ActionResult> {
  const { count } = await prisma.task.deleteMany({
    where: { id: taskId, isBacklog: true },
  });
  if (count === 0) return { ok: false, error: "Task is not in the backlog" };

  revalidatePath("/");
  return { ok: true };
}
