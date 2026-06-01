import { prisma } from "@/lib/db";
import { addDays, weekStart } from "@/lib/domain/time";
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

export async function getCategories() {
  return prisma.category.findMany({ orderBy: { createdAt: "asc" } });
}
