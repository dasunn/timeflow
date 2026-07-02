"use client";

import { CheckIcon, FlameIcon, PencilIcon, Trash2Icon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { deleteStreak, toggleStreakToday } from "@/lib/actions/streaks";
import { computeCurrentStreak, dateKey, last7Days } from "@/lib/domain/streaks";
import type { StreakWithEntries } from "@/lib/domain/types";
import { cn } from "@/lib/utils";

export function StreakCard({
  streak,
  today,
  onEdit,
}: {
  streak: StreakWithEntries;
  today: Date;
  onEdit: () => void;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [confirming, setConfirming] = useState(false);

  const markedDates = new Set(streak.entries.map((e) => e.date));
  const currentStreak = computeCurrentStreak(markedDates, today);
  const todayKey = dateKey(today);
  const doneToday = markedDates.has(todayKey);
  const days = last7Days(today);

  function toggle() {
    startTransition(async () => {
      await toggleStreakToday(streak.id);
      router.refresh();
    });
  }

  function del() {
    startTransition(async () => {
      await deleteStreak(streak.id);
      router.refresh();
    });
  }

  return (
    <li className="flex items-center gap-3 rounded-lg border p-3">
      <span
        className="size-5 shrink-0 rounded-full ring-1 ring-black/10"
        style={{ backgroundColor: streak.color }}
      />

      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="truncate font-medium">{streak.name}</span>
          <span className="flex shrink-0 items-center gap-1 text-sm text-muted-foreground">
            <FlameIcon
              className={cn(
                "size-3.5",
                currentStreak > 0 && "text-orange-500",
              )}
            />
            {currentStreak} {currentStreak === 1 ? "day" : "days"}
          </span>
        </div>
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
                  "size-2.5 rounded-full",
                  !filled && "bg-muted",
                  isToday && "ring-2 ring-foreground/30 ring-offset-1 ring-offset-background",
                )}
                style={filled ? { backgroundColor: streak.color } : undefined}
              />
            );
          })}
        </div>
      </div>

      {confirming ? (
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground">Delete?</span>
          <Button size="sm" variant="destructive" disabled={pending} onClick={del}>
            Yes
          </Button>
          <Button size="sm" variant="outline" onClick={() => setConfirming(false)}>
            No
          </Button>
        </div>
      ) : (
        <div className="flex items-center gap-1">
          <Button
            size="sm"
            variant={doneToday ? "secondary" : "default"}
            disabled={pending}
            onClick={toggle}
          >
            {doneToday && <CheckIcon />}
            {doneToday ? "Done today" : "Mark today done"}
          </Button>
          <Button
            size="icon-sm"
            variant="ghost"
            aria-label="Edit streak"
            onClick={onEdit}
          >
            <PencilIcon />
          </Button>
          <Button
            size="icon-sm"
            variant="ghost"
            aria-label="Delete streak"
            onClick={() => setConfirming(true)}
          >
            <Trash2Icon />
          </Button>
        </div>
      )}
    </li>
  );
}
