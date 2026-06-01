"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { isLaterDrag } from "@/lib/domain/status";
import { taskCreateSchema } from "@/lib/domain/validation";

export type ActionResult = { ok: true } | { ok: false; error: string };

// Create a task from the inline grid creation flow.
export async function createTask(input: {
  description: string;
  categoryId: string | null;
  plannedStartMs: number;
  plannedEndMs: number;
}): Promise<ActionResult> {
  const parsed = taskCreateSchema.safeParse({
    description: input.description,
    categoryId: input.categoryId,
    plannedStart: new Date(input.plannedStartMs),
    plannedEnd: new Date(input.plannedEndMs),
  });
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid task" };
  }

  await prisma.task.create({
    data: {
      description: parsed.data.description,
      categoryId: parsed.data.categoryId ?? null,
      plannedStart: parsed.data.plannedStart,
      plannedEnd: parsed.data.plannedEnd,
    },
  });

  revalidatePath("/");
  return { ok: true };
}

// Move a task to a new planned window (from a drag). Applies the drag-delay
// rule (increment only when moved to a strictly later start) and rejects
// locked tasks server-side.
export async function moveTask(
  taskId: string,
  newStartMs: number,
  newEndMs: number,
): Promise<ActionResult> {
  const task = await prisma.task.findUnique({ where: { id: taskId } });
  if (!task) return { ok: false, error: "Task not found" };
  if (task.isLocked) return { ok: false, error: "Task is locked" };

  const newStart = new Date(newStartMs);
  const newEnd = new Date(newEndMs);
  if (newEnd.getTime() <= newStart.getTime()) {
    return { ok: false, error: "Invalid time range" };
  }

  const later = isLaterDrag(task.plannedStart, newStart);

  await prisma.task.update({
    where: { id: taskId },
    data: {
      plannedStart: newStart,
      plannedEnd: newEnd,
      ...(later ? { dragDelayCount: { increment: 1 } } : {}),
    },
  });

  revalidatePath("/");
  return { ok: true };
}

// Explicit Cancel — removes the task from the active flow but keeps the row.
export async function cancelTask(taskId: string): Promise<ActionResult> {
  await prisma.task.update({
    where: { id: taskId },
    data: { status: "CANCELLED" },
  });
  revalidatePath("/");
  return { ok: true };
}

// Undo a cancel (back to NEW). Display status is re-derived from there.
export async function reopenTask(taskId: string): Promise<ActionResult> {
  await prisma.task.update({
    where: { id: taskId },
    data: { status: "NEW" },
  });
  revalidatePath("/");
  return { ok: true };
}
