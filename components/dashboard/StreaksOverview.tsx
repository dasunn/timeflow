"use client";

import { CheckIcon, FlameIcon, PlusIcon, TrophyIcon } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { toggleStreakToday } from "@/lib/actions/streaks";
import {
  computeCurrentStreak,
  computeLongestStreak,
  dateKey,
  last7Days,
} from "@/lib/domain/streaks";
import type { StreakWithEntries } from "@/lib/domain/types";
import { cn } from "@/lib/utils";

// Rungs the ring climbs toward. Deliberately close together at the bottom: the
// first week is where a streak is most likely to die, so the next target should
// always look reachable.
const MILESTONES = [3, 7, 14, 30, 60, 100, 180, 365];

function nextMilestone(count: number): number {
  return MILESTONES.find((m) => m > count) ?? count + 100;
}

export function StreaksOverview({
  streaks,
  today,
}: {
  streaks: StreakWithEntries[];
  today: Date;
}) {
  const todayKey = dateKey(today);
  const doneToday = streaks.filter((s) =>
    s.entries.some((e) => e.date === todayKey),
  ).length;

  return (
    <Card className="h-full">
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="flex items-center gap-2">
          <FlameIcon className="size-4 text-orange-500" />
          Streaks
        </CardTitle>
        {streaks.length > 0 && (
          <span
            className={cn(
              "rounded-full px-2 py-0.5 text-xs font-medium tabular-nums",
              doneToday === streaks.length
                ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400"
                : "bg-secondary text-secondary-foreground",
            )}
          >
            {doneToday}/{streaks.length} today
          </span>
        )}
      </CardHeader>

      <CardContent className="flex-1">
        {streaks.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No streaks yet.{" "}
            <Link href="/streaks" className="text-primary hover:underline">
              Create one
            </Link>
            .
          </p>
        ) : (
          <>
            <ul className="space-y-3">
              {streaks.map((streak) => (
                <StreakRow key={streak.id} streak={streak} today={today} />
              ))}
            </ul>
            <Link
              href="/streaks"
              className="mt-3 flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
            >
              <PlusIcon className="size-3" />
              Manage streaks
            </Link>
          </>
        )}
      </CardContent>
    </Card>
  );
}

function StreakRow({
  streak,
  today,
}: {
  streak: StreakWithEntries;
  today: Date;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const markedDates = new Set(streak.entries.map((e) => e.date));
  const count = computeCurrentStreak(markedDates, today);
  const best = computeLongestStreak(markedDates);
  const todayKey = dateKey(today);
  const doneToday = markedDates.has(todayKey);
  const target = nextMilestone(count);
  const toGo = target - count;
  const days = last7Days(today);
  // A live streak that hasn't been marked yet today is the one state worth
  // nagging about — it's the only one that can break before midnight.
  const atRisk = !doneToday && count > 0;

  function toggle() {
    startTransition(async () => {
      await toggleStreakToday(streak.id);
      router.refresh();
    });
  }

  return (
    <li
      className={cn(
        "relative overflow-hidden rounded-xl border p-3 transition-colors",
        doneToday && "border-transparent",
      )}
      style={{
        ["--streak-color" as string]: streak.color,
        background: doneToday
          ? `linear-gradient(110deg, ${streak.color}2e, transparent 70%)`
          : undefined,
      }}
    >
      <div className="flex items-center gap-2.5">
        {/* Mark today. The primary action on this card — a streak is kept by
            ticking it off, so the tick is the control, not a link elsewhere. */}
        <button
          type="button"
          onClick={toggle}
          disabled={pending}
          aria-pressed={doneToday}
          aria-label={
            doneToday
              ? `Unmark ${streak.name} for today`
              : `Mark ${streak.name} done today`
          }
          className={cn(
            "flex size-8 shrink-0 items-center justify-center rounded-full border-2 outline-none transition-transform focus-visible:ring-3 focus-visible:ring-ring/50 disabled:opacity-50",
            !pending && "hover:scale-110 active:scale-95",
            atRisk && "streak-ember",
          )}
          style={{
            borderColor: streak.color,
            backgroundColor: doneToday ? streak.color : "transparent",
          }}
        >
          <CheckIcon
            className={cn(
              "size-4 transition-opacity",
              doneToday ? "text-white opacity-100" : "opacity-25",
            )}
            style={doneToday ? undefined : { color: streak.color }}
          />
        </button>

        <div className="min-w-0 flex-1">
          <div className="flex items-baseline gap-2">
            <span className="truncate text-sm font-medium">{streak.name}</span>
            <span className="ml-auto flex shrink-0 items-center gap-1">
              <FlameIcon
                className={cn(
                  "size-3.5",
                  count > 0 ? "text-orange-500" : "text-muted-foreground",
                )}
              />
              <span className="text-sm font-bold tabular-nums">{count}</span>
              <span className="text-xs text-muted-foreground">
                {count === 1 ? "day" : "days"}
              </span>
            </span>
          </div>

          {/* Last 7 days, oldest first. */}
          <div className="mt-1.5 flex items-center gap-1">
            {days.map((d) => {
              const key = dateKey(d);
              const filled = markedDates.has(key);
              const isToday = key === todayKey;
              return (
                <span
                  key={key}
                  title={key}
                  className={cn(
                    "h-1.5 flex-1 rounded-full",
                    !filled && "bg-muted",
                    isToday && !filled && "ring-1 ring-foreground/25",
                  )}
                  style={filled ? { backgroundColor: streak.color } : undefined}
                />
              );
            })}
          </div>
        </div>
      </div>

      {/* Progress to the next milestone — the "why keep going" line. */}
      <div className="mt-2.5 flex items-center gap-2">
        <div className="relative h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
          <div
            className={cn(
              "h-full rounded-full transition-[width] duration-500",
              // The shimmer is the reward: it only runs on a streak that is
              // both alive and already ticked off for today.
              doneToday && count > 0 && "streak-shimmer",
            )}
            style={{
              width: `${(count / target) * 100}%`,
              backgroundColor: streak.color,
            }}
          />
        </div>
        <span className="shrink-0 text-[11px] text-muted-foreground tabular-nums">
          {toGo} to {target}
        </span>
        <span
          className="flex shrink-0 items-center gap-0.5 text-[11px] text-muted-foreground tabular-nums"
          title="Longest run ever"
        >
          <TrophyIcon className="size-3 text-amber-500" />
          {best}
        </span>
      </div>

      {atRisk && (
        <p className="mt-1.5 text-[11px] font-medium text-orange-600 dark:text-orange-400">
          {count}-day streak on the line — tick it off today.
        </p>
      )}
    </li>
  );
}
