"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { isLaterDrag } from "@/lib/domain/status";

export type ActionResult = { ok: true } | { ok: false; error: string };

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
