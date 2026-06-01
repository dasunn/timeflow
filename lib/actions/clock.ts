"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { sessionEditSchema } from "@/lib/domain/validation";
import type { ActionResult } from "./tasks";

// Clock in: open a new ClockSession and lock the task (first clock-in locks
// it permanently). Refuses if a session is already running.
export async function clockIn(taskId: string): Promise<ActionResult> {
  const open = await prisma.clockSession.findFirst({
    where: { taskId, clockOutAt: null },
  });
  if (open) return { ok: false, error: "Already clocked in" };

  await prisma.$transaction([
    prisma.clockSession.create({ data: { taskId, clockInAt: new Date() } }),
    prisma.task.update({ where: { id: taskId }, data: { isLocked: true } }),
  ]);

  revalidatePath("/");
  return { ok: true };
}

// Clock out: close the currently-open session.
export async function clockOut(taskId: string): Promise<ActionResult> {
  const open = await prisma.clockSession.findFirst({
    where: { taskId, clockOutAt: null },
    orderBy: { clockInAt: "desc" },
  });
  if (!open) return { ok: false, error: "Not clocked in" };

  await prisma.clockSession.update({
    where: { id: open.id },
    data: { clockOutAt: new Date() },
  });

  revalidatePath("/");
  return { ok: true };
}

// Complete: only allowed once clocked out (no running session).
export async function completeTask(taskId: string): Promise<ActionResult> {
  const open = await prisma.clockSession.findFirst({
    where: { taskId, clockOutAt: null },
  });
  if (open) return { ok: false, error: "Clock out before completing" };

  await prisma.task.update({
    where: { id: taskId },
    data: { status: "COMPLETED", isLocked: true },
  });

  revalidatePath("/");
  return { ok: true };
}

// ---- Manual editing of clock sessions (after the fact) -------------------

export async function updateClockSession(
  id: string,
  clockInMs: number,
  clockOutMs: number | null,
): Promise<ActionResult> {
  const parsed = sessionEditSchema.safeParse({
    clockInAt: new Date(clockInMs),
    clockOutAt: clockOutMs === null ? null : new Date(clockOutMs),
  });
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid times" };
  }
  await prisma.clockSession.update({
    where: { id },
    data: { clockInAt: parsed.data.clockInAt, clockOutAt: parsed.data.clockOutAt },
  });
  revalidatePath("/");
  return { ok: true };
}

// Add a session manually (defaults to a 30-min block at the planned start);
// locks the task like any clock-in.
export async function addClockSession(taskId: string): Promise<ActionResult> {
  const task = await prisma.task.findUnique({ where: { id: taskId } });
  if (!task) return { ok: false, error: "Task not found" };

  const clockInAt = task.plannedStart;
  const clockOutAt = new Date(task.plannedStart.getTime() + 30 * 60_000);

  await prisma.$transaction([
    prisma.clockSession.create({ data: { taskId, clockInAt, clockOutAt } }),
    prisma.task.update({ where: { id: taskId }, data: { isLocked: true } }),
  ]);
  revalidatePath("/");
  return { ok: true };
}

export async function deleteClockSession(id: string): Promise<ActionResult> {
  await prisma.clockSession.delete({ where: { id } });
  revalidatePath("/");
  return { ok: true };
}
