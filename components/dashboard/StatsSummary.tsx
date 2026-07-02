import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatDuration } from "@/lib/domain/time";
import type { DashboardStats } from "@/lib/domain/dashboard";
import { cn } from "@/lib/utils";

type Level = "critical" | "needsImprovement" | "acceptable" | "good";

const LEVEL_META: Record<
  Level,
  { emoji: string; label: string; bar: string; text: string }
> = {
  critical: {
    emoji: "🔴",
    label: "Critical",
    bar: "bg-red-500",
    text: "text-red-600 dark:text-red-400",
  },
  needsImprovement: {
    emoji: "🟠",
    label: "Needs Improvement",
    bar: "bg-orange-500",
    text: "text-orange-600 dark:text-orange-400",
  },
  acceptable: {
    emoji: "🟡",
    label: "Acceptable",
    bar: "bg-yellow-500",
    text: "text-yellow-600 dark:text-yellow-400",
  },
  good: {
    emoji: "🟢",
    label: "Good",
    bar: "bg-emerald-500",
    text: "text-emerald-600 dark:text-emerald-400",
  },
};

const ENCOURAGEMENT: Record<Level, string[]> = {
  critical: [
    "Let's turn this around.",
    "Rough patch — you've got this.",
    "Time to refocus and reset.",
    "Every comeback starts somewhere.",
  ],
  needsImprovement: [
    "Getting there — don't stop now.",
    "Solid effort, keep pushing.",
    "You're closing the gap.",
    "Steady progress, stay with it.",
  ],
  acceptable: [
    "Nice work, almost there!",
    "Great pace, keep it up.",
    "You're doing well — a little more.",
    "Almost at the finish line.",
  ],
  good: [
    "Great momentum, keep going!",
    "You're crushing it!",
    "Excellent work — stay sharp.",
    "Outstanding! Keep the streak alive.",
  ],
};

function levelFor(pct: number): Level {
  if (pct < 60) return "critical";
  if (pct < 80) return "needsImprovement";
  if (pct < 90) return "acceptable";
  return "good";
}

function pickMessage(level: Level): string {
  const options = ENCOURAGEMENT[level];
  return options[Math.floor(Math.random() * options.length)];
}

function PercentGauge({ pct }: { pct: number }) {
  const level = levelFor(pct);
  const meta = LEVEL_META[level];
  const message = pickMessage(level);

  return (
    <div className="space-y-2">
      <div className="flex items-baseline gap-2">
        <span className={cn("text-3xl font-bold tabular-nums", meta.text)}>
          {Math.round(pct)}%
        </span>
        <span className="text-lg leading-none">{meta.emoji}</span>
        <span
          className={cn(
            "text-xs font-medium tracking-wide uppercase",
            meta.text,
          )}
        >
          {meta.label}
        </span>
      </div>
      <div className="h-2.5 w-full overflow-hidden rounded-full bg-muted">
        <div
          className={cn("h-full rounded-full transition-[width]", meta.bar)}
          style={{ width: `${Math.min(100, pct)}%` }}
        />
      </div>
      <p className="text-sm text-muted-foreground italic">{message}</p>
    </div>
  );
}

function StatRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium">{value}</span>
    </div>
  );
}

export function StatsSummary({ stats }: { stats: DashboardStats }) {
  const { totalTasks, completedTasks, plannedMs, actualMs } = stats;

  if (totalTasks === 0) {
    return (
      <div className="grid gap-4 sm:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Planned vs Actual</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              No tasks in this period.
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Task Completion</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              No tasks in this period.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const completionPct = (completedTasks / totalTasks) * 100;
  const actualPct = plannedMs ? Math.min(100, (actualMs / plannedMs) * 100) : 0;

  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <Card>
        <CardHeader>
          <CardTitle>Planned vs Actual</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <PercentGauge pct={actualPct} />
          <div className="space-y-1.5 border-t pt-3">
            <StatRow label="Planned" value={formatDuration(plannedMs)} />
            <StatRow label="Actual" value={formatDuration(actualMs)} />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Task Completion</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <PercentGauge pct={completionPct} />
          <div className="space-y-1.5 border-t pt-3">
            <StatRow
              label="Completed"
              value={`${completedTasks} / ${totalTasks}`}
            />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
