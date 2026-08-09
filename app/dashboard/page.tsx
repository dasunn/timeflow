import { Suspense } from "react";
import { CategoryDonutChart } from "@/components/dashboard/CategoryDonutChart";
import { CompletionCard } from "@/components/dashboard/CompletionCard";
import { DashboardFilters } from "@/components/dashboard/DashboardFilters";
import { KpiRow } from "@/components/dashboard/StatTile";
import { StreaksOverview } from "@/components/dashboard/StreaksOverview";
import { UpcomingTasks } from "@/components/dashboard/UpcomingTasks";
import {
  getCategories,
  getDashboardTasks,
  getStreaks,
  getUpcomingTasks,
} from "@/lib/data";
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

  const [tasks, upcoming, categories, streaks] = await Promise.all([
    getDashboardTasks({ start, end, categoryId }),
    getUpcomingTasks({ now, categoryId }),
    getCategories(),
    getStreaks(),
  ]);
  const stats = computeDashboardStats(tasks, now);
  const categoryBreakdown = computeCategoryBreakdown(tasks, now);

  return (
    <div className="mx-auto w-full max-w-6xl p-6 lg:p-8">
      {/* Title and filters share one row so neither spans the full width. */}
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Dashboard</h1>
          <p className="mt-0.5 text-sm text-muted-foreground">{label}</p>
        </div>
        <Suspense>
          <DashboardFilters categories={categories} />
        </Suspense>
      </header>

      <div className="mt-6">
        <KpiRow stats={stats} />
      </div>

      {/* Bento grid. The 1|2 / 2|1 span pattern gives each card the width its
          content actually needs and keeps the page off a single stacked column.
          `min-w-0` on every cell: grid items default to min-width:auto, so
          without it the widest card's min-content would set the column width
          and push the cards past a narrow container instead of shrinking. */}
      <div className="mt-4 grid min-w-0 gap-4 lg:grid-cols-3">
        <div className="min-w-0">
          <CompletionCard stats={stats} />
        </div>
        <div className="min-w-0 lg:col-span-2">
          <UpcomingTasks tasks={upcoming} serverNow={now.getTime()} />
        </div>
        <div className="min-w-0 lg:col-span-2">
          <CategoryDonutChart slices={categoryBreakdown} />
        </div>
        <div className="min-w-0">
          <StreaksOverview streaks={streaks} today={now} />
        </div>
      </div>
    </div>
  );
}
