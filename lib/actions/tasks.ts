"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { MAX_OCCURRENCES } from "@/lib/domain/recurrence";
import { isReminderChoice } from "@/lib/domain/reminders";
import {
  canDeleteTask,
  DELETE_BLOCKED_MESSAGE,
  isDelayingDrag,
} from "@/lib/domain/status";
import { taskCreateSchema } from "@/lib/domain/validation";

export type ActionResult = { ok: true } | { ok: false; error: string };

// Create a task from the inline grid creation flow. A repeating task arrives as
// its already-expanded occurrences: the client walks the rule so the calendar
// days are the USER's local ones (the server may well be running in UTC), and
// every occurrence is written as its own independent row.
export async function createTask(input: {
  description: string;
  categoryId: string | null;
  plannedStartMs: number;
  plannedEndMs: number;
  notifyMinutesBefore: number | null;
  // Further planned windows beyond the first — empty/absent for a one-off task.
  repeatOccurrences?: { startMs: number; endMs: number }[];
}): Promise<ActionResult> {
  const windows = [
    { startMs: input.plannedStartMs, endMs: input.plannedEndMs },
    ...(input.repeatOccurrences ?? []),
  ];
  if (windows.length > MAX_OCCURRENCES) {
    return {
      ok: false,
      error: `A repeat can create at most ${MAX_OCCURRENCES} tasks — shorten the date range`,
    };
  }

  const rows = [];
  for (const slot of windows) {
    const parsed = taskCreateSchema.safeParse({
      description: input.description,
      categoryId: input.categoryId,
      plannedStart: new Date(slot.startMs),
      plannedEnd: new Date(slot.endMs),
      notifyMinutesBefore: input.notifyMinutesBefore,
    });
    if (!parsed.success) {
      return {
        ok: false,
        error: parsed.error.issues[0]?.message ?? "Invalid task",
      };
    }
    rows.push({
      description: parsed.data.description,
      categoryId: parsed.data.categoryId ?? null,
      plannedStart: parsed.data.plannedStart,
      plannedEnd: parsed.data.plannedEnd,
      notifyMinutesBefore: parsed.data.notifyMinutesBefore ?? null,
    });
  }

  // All or nothing — a half-written series would be worse than none.
  await prisma.$transaction(rows.map((data) => prisma.task.create({ data })));

  revalidatePath("/");
  return { ok: true };
}

// Edit a task's plan (description, category, planned window). Only allowed
// while no time has been recorded — mirrors the pencil gate in the details
// dialog, and enforced here so a stale client can't bypass it.
export async function updateTask(input: {
  id: string;
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

  const recorded = await prisma.clockSession.count({
    where: { taskId: input.id },
  });
  if (recorded > 0) {
    return { ok: false, error: "Can't edit a task once time is recorded" };
  }

  await prisma.task.update({
    where: { id: input.id },
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

// Change (or turn off) a task's reminder after creation. Clearing notifiedAt
// re-arms delivery so an edited reminder can fire again.
export async function setTaskReminder(
  taskId: string,
  notifyMinutesBefore: number | null,
): Promise<ActionResult> {
  if (notifyMinutesBefore !== null && !isReminderChoice(notifyMinutesBefore)) {
    return { ok: false, error: "Invalid reminder" };
  }

  await prisma.task.update({
    where: { id: taskId },
    data: { notifyMinutesBefore, notifiedAt: null },
  });

  revalidatePath("/");
  return { ok: true };
}

// Move a task to a new planned window (from a drag). Applies the drag-delay
// rule (increment only when pushed out to a later DAY — same-day reshuffles
// don't count as a slip) and rejects locked tasks server-side.
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

  const delaying = isDelayingDrag(task.plannedStart, newStart);

  await prisma.task.update({
    where: { id: taskId },
    data: {
      plannedStart: newStart,
      plannedEnd: newEnd,
      ...(delaying ? { dragDelayCount: { increment: 1 } } : {}),
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

// Explicit "I'm not getting to this" — the day is written off but the task
// still counts against completion (unlike CANCELLED, which is dropped from the
// dashboard entirely). Recorded time is kept; the task is locked so it can no
// longer be dragged around.
export async function markTaskMissed(taskId: string): Promise<ActionResult> {
  const open = await prisma.clockSession.findFirst({
    where: { taskId, clockOutAt: null },
  });
  if (open) return { ok: false, error: "Clock out before marking missed" };

  await prisma.task.update({
    where: { id: taskId },
    data: { status: "MISSED", isLocked: true },
  });
  revalidatePath("/");
  return { ok: true };
}

// Permanent deletion — the pre-PENDING escape hatch. Only a task that hasn't
// reached its planned start (and was never clocked or closed out) can go; see
// canDeleteTask for the rule. Anything later keeps its row and is cancelled or
// marked missed instead, so the day's record stays honest. Clock sessions
// cascade, but by the rule there are none.
export async function deleteTask(taskId: string): Promise<ActionResult> {
  const task = await prisma.task.findUnique({
    where: { id: taskId },
    include: { _count: { select: { clockSessions: true } } },
  });
  if (!task) return { ok: false, error: "Task not found" };
  // Parked rows have a placeholder window that must never be read as a
  // schedule, so the time rule below is meaningless for them — the backlog has
  // its own delete (deleteBacklogTask).
  if (task.isBacklog) {
    return { ok: false, error: "Delete parked tasks from the backlog list" };
  }
  if (!canDeleteTask(task, new Date(), task._count.clockSessions > 0)) {
    return { ok: false, error: DELETE_BLOCKED_MESSAGE };
  }

  // Re-state the rule as a WHERE clause so a task that goes live between the
  // check above and this delete is left alone rather than quietly removed.
  const { count } = await prisma.task.deleteMany({
    where: {
      id: taskId,
      isBacklog: false,
      status: { notIn: ["COMPLETED", "MISSED"] },
      plannedStart: { gt: new Date() },
      clockSessions: { none: {} },
    },
  });
  if (count === 0) return { ok: false, error: DELETE_BLOCKED_MESSAGE };

  revalidatePath("/");
  return { ok: true };
}

// Undo a cancel / missed (back to NEW). Display status is re-derived from
// there; the lock is released only when no time was ever recorded, and a
// stale completedAt is cleared so it can't leak into a later on-time check.
export async function reopenTask(taskId: string): Promise<ActionResult> {
  const recorded = await prisma.clockSession.count({ where: { taskId } });

  await prisma.task.update({
    where: { id: taskId },
    data: { status: "NEW", isLocked: recorded > 0, completedAt: null },
  });
  revalidatePath("/");
  return { ok: true };
}
