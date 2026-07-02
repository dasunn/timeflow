import { addDays, differenceInCalendarDays, format } from "date-fns";

// Local calendar-day key, matching the app's "no tz conversion" convention.
export function dateKey(date: Date): string {
  return format(date, "yyyy-MM-dd");
}

// Inverse of dateKey. Parsed as local-time components (not via `new Date(str)`,
// which treats "yyyy-MM-dd" as UTC and can shift a day in negative offsets).
function parseDateKey(key: string): Date {
  const [year, month, day] = key.split("-").map(Number);
  return new Date(year, month - 1, day);
}

// Consecutive marked days ending today, with a one-day grace: if today isn't
// marked yet (the day isn't over), we start counting from yesterday instead
// of treating the streak as already broken. The streak only resets to 0 once
// a full calendar day has passed with no entry.
export function computeCurrentStreak(
  markedDates: ReadonlySet<string>,
  today: Date,
): number {
  let cursor = today;
  if (!markedDates.has(dateKey(cursor))) {
    cursor = addDays(cursor, -1);
  }
  let count = 0;
  while (markedDates.has(dateKey(cursor))) {
    count++;
    cursor = addDays(cursor, -1);
  }
  return count;
}

// The 7 calendar days ending today (oldest first), for the mini history strip.
export function last7Days(today: Date): Date[] {
  return Array.from({ length: 7 }, (_, i) => addDays(today, i - 6));
}

// Longest run of consecutive marked days across all of history — the
// "highest ever" record, independent of whether the streak is currently alive.
export function computeLongestStreak(markedDates: ReadonlySet<string>): number {
  if (markedDates.size === 0) return 0;
  const sorted = Array.from(markedDates)
    .map(parseDateKey)
    .sort((a, b) => a.getTime() - b.getTime());

  let longest = 1;
  let current = 1;
  for (let i = 1; i < sorted.length; i++) {
    current =
      differenceInCalendarDays(sorted[i], sorted[i - 1]) === 1 ? current + 1 : 1;
    longest = Math.max(longest, current);
  }
  return longest;
}
