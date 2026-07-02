"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatDuration } from "@/lib/domain/time";
import type { CategoryTimeSlice } from "@/lib/domain/dashboard";
import { cn } from "@/lib/utils";

const SIZE = 160;
const STROKE = 22;
const RADIUS = (SIZE - STROKE) / 2;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

type ViewMode = "planned" | "actual";

const MODE_LABELS: Record<ViewMode, string> = {
  planned: "Planned",
  actual: "Actual",
};

export function CategoryDonutChart({ slices }: { slices: CategoryTimeSlice[] }) {
  const [mode, setMode] = useState<ViewMode>("actual");

  const values = slices.map((s) => ({
    ...s,
    ms: mode === "planned" ? s.plannedMs : s.actualMs,
  }));
  const total = values.reduce((sum, s) => sum + s.ms, 0);
  const nonZero = values.filter((s) => s.ms > 0);

  let offset = 0;
  const arcs = nonZero.map((slice) => {
    const fraction = slice.ms / total;
    const dash = fraction * CIRCUMFERENCE;
    const arc = {
      ...slice,
      dasharray: `${dash} ${CIRCUMFERENCE - dash}`,
      dashoffset: -offset,
      fraction,
    };
    offset += dash;
    return arc;
  });

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>Time by Category</CardTitle>
        <div className="flex items-center gap-1 rounded-lg border border-input p-0.5">
          {(Object.keys(MODE_LABELS) as ViewMode[]).map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => setMode(m)}
              className={cn(
                "rounded-md px-2.5 py-1 text-xs font-medium transition-colors",
                mode === m
                  ? "bg-secondary text-secondary-foreground"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              {MODE_LABELS[m]}
            </button>
          ))}
        </div>
      </CardHeader>
      <CardContent>
        {total === 0 ? (
          <p className="text-sm text-muted-foreground">
            No {MODE_LABELS[mode].toLowerCase()} time in this period.
          </p>
        ) : (
          <div className="flex flex-wrap items-center gap-6">
            <div className="relative shrink-0" style={{ width: SIZE, height: SIZE }}>
              <svg
                width={SIZE}
                height={SIZE}
                viewBox={`0 0 ${SIZE} ${SIZE}`}
                className="-rotate-90"
              >
                <circle
                  cx={SIZE / 2}
                  cy={SIZE / 2}
                  r={RADIUS}
                  fill="none"
                  stroke="var(--muted)"
                  strokeWidth={STROKE}
                />
                {arcs.map((arc) => (
                  <circle
                    key={arc.categoryId ?? "uncategorized"}
                    cx={SIZE / 2}
                    cy={SIZE / 2}
                    r={RADIUS}
                    fill="none"
                    stroke={arc.color}
                    strokeWidth={STROKE}
                    strokeDasharray={arc.dasharray}
                    strokeDashoffset={arc.dashoffset}
                  />
                ))}
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className="text-base font-semibold">
                  {formatDuration(total)}
                </span>
                <span className="text-xs text-muted-foreground">
                  {MODE_LABELS[mode]}
                </span>
              </div>
            </div>

            <ul className="flex-1 space-y-1.5">
              {values
                .filter((s) => s.ms > 0)
                .map((slice) => (
                  <li
                    key={slice.categoryId ?? "uncategorized"}
                    className="flex items-center justify-between gap-3 text-sm"
                  >
                    <span className="flex min-w-0 items-center gap-2">
                      <span
                        className="size-2.5 shrink-0 rounded-full"
                        style={{ backgroundColor: slice.color }}
                      />
                      <span className="truncate">{slice.name}</span>
                    </span>
                    <span className="shrink-0 text-muted-foreground">
                      {formatDuration(slice.ms)} ·{" "}
                      {Math.round((slice.ms / total) * 100)}%
                    </span>
                  </li>
                ))}
            </ul>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
