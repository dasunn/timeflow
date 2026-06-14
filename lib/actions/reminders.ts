"use server";

import { prisma } from "@/lib/db";
import { reminderAtMs } from "@/lib/domain/reminders";

export type DueReminder = {
  id: string;
  description: string;
  plannedStartMs: number;
  minutesBefore: number;
};

// Find tasks whose reminder window has opened ([start - N, start]) and that
// haven't fired yet, mark them as notified, and return them for the client to
// surface. Marking is the fire-once guard (mirrors runAutoOverdue's pattern);
// the ReminderRunner only calls this when notifications are granted, so a
// reminder is never silently consumed.
export async function claimDueReminders(): Promise<DueReminder[]> {
  const now = new Date();

  // Candidates: a reminder is set, not yet fired, still upcoming, still active.
  // (`updateMany` can't compute the per-row offset, so we filter in JS — task
  // counts are small for a single-user app.)
  const candidates = await prisma.task.findMany({
    where: {
      notifyMinutesBefore: { not: null },
      notifiedAt: null,
      status: { notIn: ["COMPLETED", "CANCELLED"] },
      plannedStart: { gte: now },
    },
    select: {
      id: true,
      description: true,
      plannedStart: true,
      notifyMinutesBefore: true,
    },
  });

  const due = candidates.filter(
    (t) =>
      t.notifyMinutesBefore !== null &&
      reminderAtMs(t.plannedStart.getTime(), t.notifyMinutesBefore) <= now.getTime(),
  );

  if (due.length === 0) return [];

  await prisma.task.updateMany({
    where: { id: { in: due.map((d) => d.id) } },
    data: { notifiedAt: now },
  });

  return due.map((t) => ({
    id: t.id,
    description: t.description,
    plannedStartMs: t.plannedStart.getTime(),
    minutesBefore: t.notifyMinutesBefore as number,
  }));
}
