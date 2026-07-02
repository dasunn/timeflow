import Link from "next/link";
import { FlameIcon, TrophyIcon } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { computeCurrentStreak, computeLongestStreak } from "@/lib/domain/streaks";
import type { StreakWithEntries } from "@/lib/domain/types";
import { cn } from "@/lib/utils";

export function StreaksOverview({
  streaks,
  today,
}: {
  streaks: StreakWithEntries[];
  today: Date;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Streaks</CardTitle>
      </CardHeader>
      <CardContent>
        {streaks.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No streaks yet.{" "}
            <Link href="/streaks" className="text-primary hover:underline">
              Create one
            </Link>
            .
          </p>
        ) : (
          <ul className="space-y-2">
            {streaks.map((streak) => {
              const markedDates = new Set(streak.entries.map((e) => e.date));
              const count = computeCurrentStreak(markedDates, today);
              const best = computeLongestStreak(markedDates);
              return (
                <li
                  key={streak.id}
                  className="flex items-center justify-between gap-3 text-sm"
                >
                  <span className="flex min-w-0 items-center gap-2">
                    <span
                      className="size-2.5 shrink-0 rounded-full"
                      style={{ backgroundColor: streak.color }}
                    />
                    <span className="truncate">{streak.name}</span>
                  </span>
                  <span className="flex shrink-0 items-center gap-3 text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <FlameIcon
                        className={cn("size-3.5", count > 0 && "text-orange-500")}
                      />
                      {count} {count === 1 ? "day" : "days"}
                    </span>
                    <span className="flex items-center gap-1">
                      <TrophyIcon className="size-3.5 text-amber-500" />
                      Best {best}
                    </span>
                  </span>
                </li>
              );
            })}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
