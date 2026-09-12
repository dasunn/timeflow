import type { LucideIcon } from "lucide-react";
import { CalendarClockIcon, CircleCheckIcon, TimerIcon } from "lucide-react";
import { CompletionTile } from "@/components/dashboard/CompletionCard";
import { Card } from "@/components/ui/card";
import type { DashboardStats } from "@/lib/domain/dashboard";
import { formatDuration } from "@/lib/domain/time";

// A headline number with its label. Deliberately not a chart — a single value
// is better read as a figure than as a one-bar bar chart.
//
// `value` uses the font's default proportional figures: tabular-nums gives every
// digit the width of a zero, which reads loose at display sizes. Tabular figures
// are reserved for columns that align vertically.
function StatTile({
  icon: Icon,
  label,
  value,
  hint,
}: {
  icon: LucideIcon;
  label: string;
  value: string;
  hint?: string;
}) {
  return (
    <Card size="sm" className="gap-0 px-4 py-3.5">
      <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
        <Icon className="size-3.5" />
        {label}
      </div>
      <div className="mt-1.5 text-2xl leading-none font-semibold">{value}</div>
      {hint && (
        <div className="mt-1 text-xs text-muted-foreground">{hint}</div>
      )}
    </Card>
  );
}

export function KpiRow({ stats }: { stats: DashboardStats }) {
  const { completedTasks, countableTasks, upcomingTasks, actualMs } = stats;

  // Four across from lg up — the completion rate joined this row so the space
  // it held in the bento grid below could go to the streaks.
  return (
    <div className="grid min-w-0 gap-3 sm:grid-cols-2 lg:grid-cols-4">
      <StatTile
        icon={CircleCheckIcon}
        label="Completed"
        value={String(completedTasks)}
        hint={countableTasks > 0 ? `of ${countableTasks} due` : "nothing due yet"}
      />
      <StatTile
        icon={TimerIcon}
        label="Time tracked"
        value={formatDuration(actualMs)}
        hint="in this period"
      />
      <StatTile
        icon={CalendarClockIcon}
        label="Upcoming"
        value={String(upcomingTasks)}
        hint="not yet due"
      />
      <CompletionTile stats={stats} />
    </div>
  );
}
