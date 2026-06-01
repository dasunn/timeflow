"use server";

import { prisma } from "@/lib/db";

// Auto-overdue: tasks whose planned end has passed with no clock-in (and not
// completed/cancelled) get a one-time autoDelayCount bump. Guarded by
// autoDelayCount === 0 so reloads/interval ticks never double-count. This is
// the batched mirror of shouldAutoDelay() in lib/domain/status.ts and is kept
// entirely separate from the manual dragDelayCount.
export async function runAutoOverdue(): Promise<{ updated: number }> {
  const now = new Date();

  // updateMany can't filter on relations, so find eligible ids first.
  const eligible = await prisma.task.findMany({
    where: {
      status: { notIn: ["COMPLETED", "CANCELLED"] },
      autoDelayCount: 0,
      plannedEnd: { lt: now },
      clockSessions: { none: {} },
    },
    select: { id: true },
  });

  if (eligible.length === 0) return { updated: 0 };

  await prisma.task.updateMany({
    where: { id: { in: eligible.map((e) => e.id) } },
    data: { autoDelayCount: { increment: 1 } },
  });

  return { updated: eligible.length };
}
