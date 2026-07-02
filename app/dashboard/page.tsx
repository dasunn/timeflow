import { Suspense } from "react";
import { CategoryDonutChart } from "@/components/dashboard/CategoryDonutChart";
import { DashboardFilters } from "@/components/dashboard/DashboardFilters";
import { StatsSummary } from "@/components/dashboard/StatsSummary";
import { getCategories, getDashboardTasks } from "@/lib/data";
import {
  computeCategoryBreakdown,
  computeDashboardStats,
  isDashboardPeriod,
  resolveDateRange,
} from "@/lib/domain/dashboard";

export const metadata = { title: "Dashboard · TimeFlow" };

// Always reflect the live local database (no build-time prerender snapshot).
export const dynamic = "force-dynamic";

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ period?: string; month?: string; category?: string }>;
}) {
  const { period: periodParam, month, category } = await searchParams;
  const now = new Date();
  const period = periodParam && isDashboardPeriod(periodParam) ? periodParam : "week";
  const categoryId = category && category !== "all" ? category : null;

  const { start, end, label } = resolveDateRange(period, month, now);

  const [tasks, categories] = await Promise.all([
    getDashboardTasks({ start, end, categoryId }),
    getCategories(),
  ]);
  const stats = computeDashboardStats(tasks, now);
  const categoryBreakdown = computeCategoryBreakdown(tasks, now);

  return (
    <div className="mx-auto w-full max-w-4xl p-6">
      <header className="mb-6">
        <h1 className="text-xl font-semibold">Dashboard</h1>
        <p className="text-sm text-muted-foreground">{label}</p>
      </header>

      <Suspense>
        <DashboardFilters categories={categories} />
      </Suspense>

      <div className="mt-6">
        <StatsSummary stats={stats} />
      </div>

      <div className="mt-4">
        <CategoryDonutChart slices={categoryBreakdown} />
      </div>
    </div>
  );
}
