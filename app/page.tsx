import Link from "next/link";
import { format } from "date-fns";
import { ChevronLeftIcon, ChevronRightIcon, SettingsIcon } from "lucide-react";
import { AutoOverdueRunner } from "@/components/AutoOverdueRunner";
import { CalendarWorkspace } from "@/components/calendar/CalendarWorkspace";
import { buttonVariants } from "@/components/ui/button";
import { getCategories, getNowPanelTasks, getTasksForWeek } from "@/lib/data";
import { addDays, weekDays, weekStart } from "@/lib/domain/time";
import { cn } from "@/lib/utils";

function parseAnchor(dateParam?: string): Date {
  if (dateParam) {
    const d = new Date(`${dateParam}T00:00:00`);
    if (!Number.isNaN(d.getTime())) return d;
  }
  return new Date();
}

export default async function Home({
  searchParams,
}: {
  searchParams: Promise<{ date?: string }>;
}) {
  const { date } = await searchParams;
  const anchor = parseAnchor(date);
  const start = weekStart(anchor);
  const days = weekDays(anchor);
  const now = new Date();

  const [weekTasks, nowTasks, categories] = await Promise.all([
    getTasksForWeek(anchor),
    getNowPanelTasks(now),
    getCategories(),
  ]);
  const serverNow = now.getTime();

  const prev = format(addDays(start, -7), "yyyy-MM-dd");
  const next = format(addDays(start, 7), "yyyy-MM-dd");
  const label = `${format(start, "MMM d")} – ${format(addDays(start, 6), "MMM d, yyyy")}`;

  return (
    <div className="flex h-screen flex-col">
      <AutoOverdueRunner />
      <header className="flex items-center gap-2 border-b px-4 py-2.5">
        <h1 className="text-lg font-semibold">TimeFlow</h1>

        <nav className="ml-4 flex items-center gap-1">
          <Link
            href={`/?date=${prev}`}
            aria-label="Previous week"
            className={buttonVariants({ variant: "outline", size: "icon" })}
          >
            <ChevronLeftIcon />
          </Link>
          <Link
            href="/"
            className={buttonVariants({ variant: "outline", size: "sm" })}
          >
            This week
          </Link>
          <Link
            href={`/?date=${next}`}
            aria-label="Next week"
            className={buttonVariants({ variant: "outline", size: "icon" })}
          >
            <ChevronRightIcon />
          </Link>
          <span className="ml-2 text-sm text-muted-foreground">{label}</span>
        </nav>

        <Link
          href="/categories"
          className={cn(
            buttonVariants({ variant: "ghost", size: "sm" }),
            "ml-auto",
          )}
        >
          <SettingsIcon />
          Categories
        </Link>
      </header>

      <CalendarWorkspace
        days={days}
        weekTasks={weekTasks}
        nowTasks={nowTasks}
        categories={categories}
        serverNow={serverNow}
      />
    </div>
  );
}
