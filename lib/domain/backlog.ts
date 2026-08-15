// The backlog holds tasks that have no place on the calendar yet — "do this at
// some point". A backlog row is a normal Task with `isBacklog` set and an inert
// placeholder planned window (start === end); nothing may read that window
// while the flag is on. Dragging the task onto the grid writes a real window,
// clears the flag, and from then on it's an ordinary task.

// How long the task is expected to take. Used purely as the duration it gets
// when it lands on the calendar, so it arrives the right size.
export const ESTIMATE_CHOICES = [15, 30, 45, 60, 90, 120, 180, 240] as const;
export type EstimateChoice = (typeof ESTIMATE_CHOICES)[number];

export const DEFAULT_ESTIMATE_MINUTES: EstimateChoice = 60;

export function isEstimateChoice(value: number): value is EstimateChoice {
  return (ESTIMATE_CHOICES as readonly number[]).includes(value);
}

// "45m" / "1h" / "1h 30m" — formatDuration's "1h 0m" reads badly on a chip.
export function formatEstimate(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h === 0) return `${m}m`;
  return m === 0 ? `${h}h` : `${h}h ${m}m`;
}

// Duration to schedule a backlog task at: its estimate, or the 1h fallback for
// rows saved before an estimate was recorded.
export function scheduledMinutes(estimatedMinutes: number | null): number {
  return estimatedMinutes && estimatedMinutes > 0
    ? estimatedMinutes
    : DEFAULT_ESTIMATE_MINUTES;
}
