import type { LucideIcon } from "lucide-react";
import {
  CircleAlertIcon,
  CircleCheckIcon,
  CircleDotIcon,
  TriangleAlertIcon,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { DashboardStats } from "@/lib/domain/dashboard";
import { cn } from "@/lib/utils";

type Level = "critical" | "needsImprovement" | "acceptable" | "good";

// A reserved status scale — these four steps mean "state", never "series N".
// Each ships with an icon AND a label so the state never rides on color alone.
// `track` is a lighter step of the SAME hue as `bar`, so the meter reads as one
// object and the severity carries across the whole bar rather than just the fill.
const LEVEL_META: Record<
  Level,
  { icon: LucideIcon; label: string; bar: string; track: string; text: string }
> = {
  critical: {
    icon: CircleAlertIcon,
    label: "Critical",
    bar: "bg-red-500",
    track: "bg-red-100 dark:bg-red-950",
    text: "text-red-600 dark:text-red-400",
  },
  needsImprovement: {
    icon: TriangleAlertIcon,
    label: "Needs improvement",
    bar: "bg-orange-500",
    track: "bg-orange-100 dark:bg-orange-950",
    text: "text-orange-600 dark:text-orange-400",
  },
  acceptable: {
    icon: CircleDotIcon,
    label: "Acceptable",
    bar: "bg-yellow-500",
    track: "bg-yellow-100 dark:bg-yellow-950",
    text: "text-yellow-600 dark:text-yellow-400",
  },
  good: {
    icon: CircleCheckIcon,
    label: "Good",
    bar: "bg-emerald-500",
    track: "bg-emerald-100 dark:bg-emerald-950",
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

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <Card className="h-full">
      <CardHeader>
        <CardTitle>Task completion</CardTitle>
      </CardHeader>
      <CardContent className="flex-1">{children}</CardContent>
    </Card>
  );
}

export function CompletionCard({ stats }: { stats: DashboardStats }) {
  const { totalTasks, completedTasks, countableTasks, upcomingTasks } = stats;

  if (totalTasks === 0) {
    return (
      <Shell>
        <p className="text-sm text-muted-foreground">
          No tasks in this period.
        </p>
      </Shell>
    );
  }

  // Only tasks that have actually come due are scored — see isCountable().
  // A period made up entirely of future work has nothing to rate yet.
  if (countableTasks === 0) {
    return (
      <Shell>
        <p className="text-sm text-muted-foreground">
          Nothing due yet — {upcomingTasks}{" "}
          {upcomingTasks === 1 ? "task is" : "tasks are"} still ahead.
        </p>
      </Shell>
    );
  }

  const pct = (completedTasks / countableTasks) * 100;
  const rounded = Math.round(pct);
  const level = levelFor(pct);
  const meta = LEVEL_META[level];
  const Icon = meta.icon;
  // Picked from the score rather than at random: the line still varies across
  // states, but it stays put while the number does, instead of reshuffling on
  // every refresh. (Random here is also an impure call during render.)
  const message = ENCOURAGEMENT[level][rounded % ENCOURAGEMENT[level].length];

  return (
    <Shell>
      <div className="flex h-full flex-col">
        {/* The one hero figure on this page. Proportional figures, not tabular —
            equal-width digits read loose at display sizes. */}
        <div className={cn("text-5xl leading-none font-semibold", meta.text)}>
          {rounded}%
        </div>

        <div
          className={cn("mt-2.5 flex items-center gap-1.5 text-sm", meta.text)}
        >
          <Icon className="size-4" />
          <span className="font-medium">{meta.label}</span>
        </div>

        {/* Meter: fill carries severity, track is a lighter step of the same hue. */}
        <div
          className={cn(
            "mt-3 h-2 w-full overflow-hidden rounded-full",
            meta.track,
          )}
        >
          <div
            className={cn("h-full rounded-full", meta.bar)}
            style={{ width: `${Math.min(100, pct)}%` }}
          />
        </div>

        <p className="mt-3 text-sm text-muted-foreground italic">{message}</p>

        <dl className="mt-auto space-y-1.5 border-t pt-3 text-sm">
          <div className="flex items-baseline justify-between">
            <dt className="text-muted-foreground">Completed</dt>
            <dd className="font-medium tabular-nums">
              {completedTasks} / {countableTasks}
            </dd>
          </div>
          {upcomingTasks > 0 && (
            <div className="flex items-baseline justify-between">
              <dt className="text-muted-foreground">Upcoming (not scored)</dt>
              <dd className="font-medium tabular-nums">{upcomingTasks}</dd>
            </div>
          )}
        </dl>
      </div>
    </Shell>
  );
}
