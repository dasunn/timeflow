import { prisma } from "@/lib/db";
import { addDays, startOfDay, weekStart } from "@/lib/domain/time";
import type { TaskWithRelations } from "@/lib/domain/types";

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
