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

// Add a completed session by hand, for work that happened away from the
// clock-in/out buttons. Same effects as a real clock-in/out pair: the task is
// locked (time has been recorded on it) and it becomes completable. Refuses to
// stack a manual entry on top of a session that's still running, so the
// task's tracked total can't be built from overlapping halves.
export async function addClockSession(input: {
  taskId: string;
  clockInMs: number;
  clockOutMs: number;
}): Promise<ActionResult> {
  const parsed = sessionEditSchema.safeParse({
    clockInAt: new Date(input.clockInMs),
    clockOutAt: new Date(input.clockOutMs),
  });
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid session" };
  }
  if (parsed.data.clockOutAt!.getTime() === parsed.data.clockInAt.getTime()) {
    return { ok: false, error: "Session must be longer than 0 minutes" };
  }

  const open = await prisma.clockSession.findFirst({
    where: { taskId: input.taskId, clockOutAt: null },
  });
  if (open) return { ok: false, error: "Clock out before adding a session" };

  await prisma.$transaction([
    prisma.clockSession.create({
      data: {
        taskId: input.taskId,
        clockInAt: parsed.data.clockInAt,
        clockOutAt: parsed.data.clockOutAt,
      },
    }),
    prisma.task.update({
      where: { id: input.taskId },
      data: { isLocked: true },
    }),
  ]);

  revalidatePath("/");
  return { ok: true };
}

// Complete. Does NOT require a clock-in — plenty of work gets done without the
// timer running, and refusing to close those tasks just leaves them rotting on
// the calendar. The only bar is an OPEN session, which must be clocked out
// first so the tracked total isn't left dangling.
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

// Delete a session (e.g. to remove an accidental clock-in/out). If that was
// the last recorded time, the lock is released again — the lock exists because
// time was recorded (see isLockable), so with no sessions left there's nothing
// to protect. COMPLETED / MISSED keep their lock: those are stated outcomes,
// and reopenTask is the path that reconsiders them.
export async function deleteClockSession(id: string): Promise<ActionResult> {
  const session = await prisma.clockSession.findUnique({
    where: { id },
    select: { taskId: true },
  });
  if (!session) return { ok: false, error: "Session not found" };

  await prisma.clockSession.delete({ where: { id } });

  const remaining = await prisma.clockSession.count({
    where: { taskId: session.taskId },
  });
  if (remaining === 0) {
    await prisma.task.updateMany({
      where: {
        id: session.taskId,
        status: { notIn: ["COMPLETED", "MISSED"] },
      },
      data: { isLocked: false },
    });
  }

  revalidatePath("/");
  return { ok: true };
}
