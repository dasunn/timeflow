import { prisma } from "@/lib/db";
import { addDays, startOfDay, weekStart } from "@/lib/domain/time";
import type { StreakWithEntries, TaskWithRelations } from "@/lib/domain/types";

// Tasks whose planned start falls within the Monday-anchored week.
export async function getTasksForWeek(anchor: Date): Promise<TaskWithRelations[]> {
  const start = weekStart(anchor);
  const end = addDays(start, 7);
  return prisma.task.findMany({
    where: { plannedStart: { gte: start, lt: end } },
    include: {
      category: true,
      clockSessions: { orderBy: { clockInAt: "asc" } },
    },
    orderBy: { plannedStart: "asc" },
  });
}

// Tasks relevant to the Now panel regardless of which week is being viewed:
// anything scheduled today, plus anything with a still-running clock session.
export async function getNowPanelTasks(now: Date): Promise<TaskWithRelations[]> {
  const dayStart = startOfDay(now);
  const dayEnd = addDays(dayStart, 1);
  return prisma.task.findMany({
    where: {
      status: { not: "CANCELLED" },
      OR: [
        { plannedStart: { gte: dayStart, lt: dayEnd } },
        { clockSessions: { some: { clockOutAt: null } } },
      ],
    },
    include: {
      category: true,
      clockSessions: { orderBy: { clockInAt: "asc" } },
    },
    orderBy: { plannedStart: "asc" },
  });
}

export async function getCategories() {
  return prisma.category.findMany({ orderBy: { createdAt: "asc" } });
}

export async function getStreaks(): Promise<StreakWithEntries[]> {
  return prisma.streak.findMany({
    include: { entries: true },
    orderBy: { createdAt: "asc" },
  });
}

// The next few tasks still ahead of `now`, for the dashboard's Upcoming card.
// Deliberately NOT bound to the dashboard's period filter — "what's next" is
// only useful when it can look past the end of the selected window — but it
// does honour the category filter so the whole page stays consistent.
export async function getUpcomingTasks({
  now,
  categoryId,
  limit = 5,
}: {
  now: Date;
  categoryId: string | null;
  limit?: number;
}): Promise<TaskWithRelations[]> {
  return prisma.task.findMany({
    where: {
      status: { notIn: ["CANCELLED", "COMPLETED", "MISSED"] },
      plannedStart: { gt: now },
      ...(categoryId ? { categoryId } : {}),
    },
    include: {
      category: true,
      clockSessions: { orderBy: { clockInAt: "asc" } },
    },
    orderBy: { plannedStart: "asc" },
    take: limit,
  });
}

// Tasks for the dashboard: an optional [start, end) planned-start window and
// an optional category filter, always excluding CANCELLED tasks (they don't
// represent real planned or completed work).
export async function getDashboardTasks({
  start,
  end,
  categoryId,
}: {
  start: Date | null;
  end: Date | null;
  categoryId: string | null;
}): Promise<TaskWithRelations[]> {
  return prisma.task.findMany({
    where: {
      status: { not: "CANCELLED" },
      ...(start && end ? { plannedStart: { gte: start, lt: end } } : {}),
      ...(categoryId ? { categoryId } : {}),
    },
    include: {
      category: true,
      clockSessions: { orderBy: { clockInAt: "asc" } },
    },
    orderBy: { plannedStart: "asc" },
  });
}
