import { Suspense } from "react";
import { CategoryDonutChart } from "@/components/dashboard/CategoryDonutChart";
import { DashboardFilters } from "@/components/dashboard/DashboardFilters";
import { DigitalClock } from "@/components/dashboard/DigitalClock";
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
  DEFAULT_DASHBOARD_PERIOD,
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
  const period =
    periodParam && isDashboardPeriod(periodParam)
      ? periodParam
      : DEFAULT_DASHBOARD_PERIOD;
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
    <div className="mx-auto w-full max-w-7xl p-4 lg:p-6">
      {/* Title, clock and filters share one row. The clock sits between them so
          the header carries the one thing this page is really about — the time
          right now — without spending a card on it. */}
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-2xl font-semibold tracking-tight">Dashboard</h1>
          <p className="mt-0.5 text-sm text-muted-foreground">{label}</p>
        </div>
        <DigitalClock serverNow={now.getTime()} />
        <Suspense>
          <DashboardFilters categories={categories} />
        </Suspense>
      </header>

      <div className="mt-4">
        <KpiRow stats={stats} />
      </div>

      {/* Bento grid. Streaks take the tall left column across both rows — it is
          a list that grows, and the height is what lets each entry carry its
          own progress rather than collapsing to one line.
          `min-w-0` on every cell: grid items default to min-width:auto, so
          without it the widest card's min-content would set the column width
          and push the cards past a narrow container instead of shrinking. */}
      <div className="mt-3 grid min-w-0 gap-3 lg:grid-cols-3">
        <div className="min-w-0 lg:row-span-2">
          <StreaksOverview streaks={streaks} today={now} />
        </div>
        <div className="min-w-0 lg:col-span-2">
          <UpcomingTasks tasks={upcoming} serverNow={now.getTime()} />
        </div>
        <div className="min-w-0 lg:col-span-2">
          <CategoryDonutChart slices={categoryBreakdown} />
        </div>
      </div>
    </div>
  );
}
