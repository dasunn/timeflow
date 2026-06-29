"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
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
    data: { status: "COMPLETED", isLocked: true, completedAt: new Date() },
  });

  revalidatePath("/");
  return { ok: true };
}

// Delete a session (e.g. to remove an accidental clock-in/out).
export async function deleteClockSession(id: string): Promise<ActionResult> {
  await prisma.clockSession.delete({ where: { id } });
  revalidatePath("/");
  return { ok: true };
}
