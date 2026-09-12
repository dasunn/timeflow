"use client";

import { format } from "date-fns";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { ThemeToggle } from "@/components/theme/ThemeToggle";
import {
  DASHBOARD_PERIODS,
  DEFAULT_DASHBOARD_PERIOD,
  isDashboardPeriod,
  type DashboardPeriod,
} from "@/lib/domain/dashboard";
import type { Category } from "@/lib/domain/types";

// Compact by design: this row shares the header with the title and the clock,
// and the filters are set once and then ignored. The visible labels are gone —
// each control's own value already names it ("Today", "All categories") — but
// aria-label keeps them named for screen readers.
const SELECT_CLASS =
  "h-8 rounded-lg border border-input bg-transparent px-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-input/30";

const PERIOD_LABELS: Record<DashboardPeriod, string> = {
  today: "Today",
  week: "This week",
  month: "Select month",
  all: "All time",
};

export function DashboardFilters({ categories }: { categories: Category[] }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const periodParam = searchParams.get("period") ?? DEFAULT_DASHBOARD_PERIOD;
  const period = isDashboardPeriod(periodParam)
    ? periodParam
    : DEFAULT_DASHBOARD_PERIOD;
  const month = searchParams.get("month") ?? format(new Date(), "yyyy-MM");
  const category = searchParams.get("category") ?? "all";

  function updateParam(key: string, value: string) {
    const params = new URLSearchParams(searchParams.toString());
    if (value) params.set(key, value);
    else params.delete(key);
    router.push(`${pathname}?${params.toString()}`);
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <select
        aria-label="Period"
        className={SELECT_CLASS}
        value={period}
        onChange={(e) => updateParam("period", e.target.value)}
      >
        {DASHBOARD_PERIODS.map((p) => (
          <option key={p} value={p}>
            {PERIOD_LABELS[p]}
          </option>
        ))}
      </select>

      {period === "month" && (
        <input
          aria-label="Month"
          type="month"
          className={SELECT_CLASS}
          value={month}
          onChange={(e) => updateParam("month", e.target.value)}
        />
      )}

      <select
        aria-label="Category"
        className={SELECT_CLASS}
        value={category}
        onChange={(e) => updateParam("category", e.target.value)}
      >
        <option value="all">All categories</option>
        {categories.map((c) => (
          <option key={c.id} value={c.id}>
            {c.name}
          </option>
        ))}
      </select>

      <ThemeToggle />
    </div>
  );
}
