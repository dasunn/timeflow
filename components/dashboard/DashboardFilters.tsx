"use client";

import { format } from "date-fns";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Label } from "@/components/ui/label";
import {
  DASHBOARD_PERIODS,
  isDashboardPeriod,
  type DashboardPeriod,
} from "@/lib/domain/dashboard";
import type { Category } from "@/lib/domain/types";

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

  const periodParam = searchParams.get("period") ?? "week";
  const period = isDashboardPeriod(periodParam) ? periodParam : "week";
  const month = searchParams.get("month") ?? format(new Date(), "yyyy-MM");
  const category = searchParams.get("category") ?? "all";

  function updateParam(key: string, value: string) {
    const params = new URLSearchParams(searchParams.toString());
    if (value) params.set(key, value);
    else params.delete(key);
    router.push(`${pathname}?${params.toString()}`);
  }

  return (
    <div className="flex flex-wrap items-end gap-3">
      <div className="space-y-1.5">
        <Label htmlFor="period">Period</Label>
        <select
          id="period"
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
      </div>

      {period === "month" && (
        <div className="space-y-1.5">
          <Label htmlFor="month">Month</Label>
          <input
            id="month"
            type="month"
            className={SELECT_CLASS}
            value={month}
            onChange={(e) => updateParam("month", e.target.value)}
          />
        </div>
      )}

      <div className="space-y-1.5">
        <Label htmlFor="category">Category</Label>
        <select
          id="category"
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
      </div>
    </div>
  );
}
