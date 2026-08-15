import { addDays, dateAtMinutes, startOfDay } from "@/lib/domain/time";

// Repeating tasks are MATERIALISED at creation time: every occurrence becomes
// its own Task row, so each one drags, clocks, completes and counts on the
// dashboard independently. There is no series record — once created, the copies
// are ordinary tasks and nothing links them.

export const REPEAT_FREQUENCIES = ["DAILY", "WEEKLY", "MONTHLY"] as const;
export type RepeatFrequency = (typeof REPEAT_FREQUENCIES)[number];

export const REPEAT_FREQUENCY_LABELS: Record<RepeatFrequency, string> = {
  DAILY: "Every day",
  WEEKLY: "Every week",
  MONTHLY: "Every month",
};

// Monday-first to match the calendar week; `index` is JS Date.getDay().
export const WEEKDAY_OPTIONS = [
  { index: 1, short: "M", label: "Monday" },
  { index: 2, short: "T", label: "Tuesday" },
  { index: 3, short: "W", label: "Wednesday" },
  { index: 4, short: "T", label: "Thursday" },
  { index: 5, short: "F", label: "Friday" },
  { index: 6, short: "S", label: "Saturday" },
  { index: 0, short: "S", label: "Sunday" },
] as const;

// Guard rails: one create can't spawn an unbounded number of rows, and the
// window the expansion walks is bounded so it always terminates quickly.
export const MAX_OCCURRENCES = 200;
export const MAX_REPEAT_SPAN_DAYS = 730; // ~2 years

export type RepeatRule = {
  frequency: RepeatFrequency;
  weekdays: number[]; // WEEKLY only — Date.getDay() values
  monthDay: number; // MONTHLY only — 1..31
};

export function isRepeatFrequency(value: string): value is RepeatFrequency {
  return (REPEAT_FREQUENCIES as readonly string[]).includes(value);
}

// Days in the given month (1-indexed month is avoided: day 0 of the NEXT month
// is the last day of this one).
function daysInMonth(year: number, monthIndex: number): number {
  return new Date(year, monthIndex + 1, 0).getDate();
}

// Every calendar day in [from, until] matching the rule. Stops one past
// MAX_OCCURRENCES so callers can tell "too many" apart from "exactly the max".
export function repeatDays(rule: RepeatRule, from: Date, until: Date): Date[] {
  const first = startOfDay(from);
  const span = addDays(first, MAX_REPEAT_SPAN_DAYS);
  const untilDay = startOfDay(until);
  const last = untilDay > span ? span : untilDay;
  const days: Date[] = [];
  if (last < first) return days;

  if (rule.frequency === "MONTHLY") {
    // Walk month by month. Months shorter than the chosen day (e.g. the 31st in
    // February) simply have no occurrence — the date is never rolled backwards.
    let year = first.getFullYear();
    let month = first.getMonth();
    while (days.length <= MAX_OCCURRENCES) {
      const monthStart = new Date(year, month, 1);
      if (monthStart > last) break;
      if (rule.monthDay <= daysInMonth(year, month)) {
        const day = new Date(year, month, rule.monthDay);
        if (day >= first && day <= last) days.push(day);
      }
      month += 1;
      if (month > 11) {
        month = 0;
        year += 1;
      }
    }
    return days;
  }

  for (let day = first; day <= last; day = addDays(day, 1)) {
    if (rule.frequency === "DAILY" || rule.weekdays.includes(day.getDay())) {
      days.push(day);
      if (days.length > MAX_OCCURRENCES) break;
    }
  }
  return days;
}

// The planned windows for a repeating task: the rule expanded over
// [from, until], each occurrence keeping the same time of day.
export function repeatOccurrences({
  rule,
  from,
  until,
  startMinutes,
  endMinutes,
}: {
  rule: RepeatRule;
  from: Date;
  until: Date;
  startMinutes: number;
  endMinutes: number;
}): { startMs: number; endMs: number }[] {
  return repeatDays(rule, from, until).map((day) => ({
    startMs: dateAtMinutes(day, startMinutes).getTime(),
    endMs: dateAtMinutes(day, endMinutes).getTime(),
  }));
}
