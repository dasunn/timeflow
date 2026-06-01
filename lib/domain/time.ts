import {
  addDays,
  addMinutes,
  differenceInMinutes,
  format,
  isSameDay,
  startOfDay,
  startOfWeek,
} from "date-fns";

// ---- Grid constants -------------------------------------------------------
// The base grid is a 24h day split into 30-minute slots.
export const SLOT_MINUTES = 30;
export const SLOTS_PER_DAY = (24 * 60) / SLOT_MINUTES; // 48
export const MINUTES_PER_DAY = 24 * 60; // 1440
export const SLOT_HEIGHT_PX = 32; // vertical pixels per 30-min slot
export const DAY_HEIGHT_PX = SLOTS_PER_DAY * SLOT_HEIGHT_PX; // 1536

// ---- Week helpers (Monday-start) -----------------------------------------
export function weekStart(date: Date): Date {
  return startOfWeek(date, { weekStartsOn: 1 });
}

export function weekDays(date: Date): Date[] {
  const start = weekStart(date);
  return Array.from({ length: 7 }, (_, i) => addDays(start, i));
}

export { isSameDay, startOfDay, addDays };

// ---- Time <-> position math ----------------------------------------------
export function minutesSinceMidnight(date: Date): number {
  return date.getHours() * 60 + date.getMinutes();
}

// Vertical offset (px) of a time within its day column.
export function topPx(date: Date): number {
  return (minutesSinceMidnight(date) / SLOT_MINUTES) * SLOT_HEIGHT_PX;
}

export function durationMinutes(start: Date, end: Date): number {
  return differenceInMinutes(end, start);
}

// Card height (px). Clamped to at least one slot so tiny tasks stay readable.
export function heightPx(start: Date, end: Date): number {
  const mins = Math.max(SLOT_MINUTES, durationMinutes(start, end));
  return (mins / SLOT_MINUTES) * SLOT_HEIGHT_PX;
}

// Snap a minute count to the nearest 30-min slot.
export function snapMinutes(minutes: number): number {
  return Math.round(minutes / SLOT_MINUTES) * SLOT_MINUTES;
}

// Build a Date from a day (date part only) + minutes since midnight.
export function dateAtMinutes(day: Date, minutes: number): Date {
  return addMinutes(startOfDay(day), minutes);
}

// Given a target day and the dragged card's pixel offset from the top of the
// day column, compute the snapped new start, clamped so the task still fits
// within the day.
export function startFromOffsetPx(
  targetDay: Date,
  offsetTopPx: number,
  durationMin: number,
): Date {
  let minutes = snapMinutes((offsetTopPx / SLOT_HEIGHT_PX) * SLOT_MINUTES);
  minutes = Math.max(0, Math.min(minutes, MINUTES_PER_DAY - durationMin));
  return dateAtMinutes(targetDay, minutes);
}

// Half-open interval [start, end): is `now` inside the planned window?
export function isWithinPlanned(start: Date, end: Date, now: Date): boolean {
  return now.getTime() >= start.getTime() && now.getTime() < end.getTime();
}

// ---- Formatting -----------------------------------------------------------
export function formatHm(date: Date): string {
  return format(date, "HH:mm");
}

export function formatTimeRange(start: Date, end: Date): string {
  return `${formatHm(start)}–${formatHm(end)}`;
}

// Label for a gutter slot index (0 => "00:00", 47 => "23:30").
export function slotLabel(slotIndex: number): string {
  const minutes = slotIndex * SLOT_MINUTES;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

// "1h 23m" / "5m" — for accumulated tracked time.
export function formatDuration(ms: number): string {
  const totalMin = Math.max(0, Math.floor(ms / 60000));
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  return h === 0 ? `${m}m` : `${h}h ${m}m`;
}

// "1:23:45" — for the live running timer (ticks every second).
export function formatClockDuration(ms: number): string {
  const totalSec = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${h}:${pad(m)}:${pad(s)}`;
}
