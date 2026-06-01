// Pure helpers over ClockSession rows. Actual tracked time = sum of
// (clockOutAt - clockInAt); an open (running) session counts up to `now`.

export interface SessionLike {
  clockInAt: Date;
  clockOutAt: Date | null;
}

export function hasAnyClockIn(sessions: SessionLike[]): boolean {
  return sessions.length > 0;
}

export function hasOpenSession(sessions: SessionLike[]): boolean {
  return sessions.some((s) => s.clockOutAt === null);
}

export function openSession<T extends SessionLike>(sessions: T[]): T | undefined {
  return sessions.find((s) => s.clockOutAt === null);
}

// Total tracked milliseconds. A running session accrues up to `now`.
export function trackedMs(sessions: SessionLike[], now: Date): number {
  return sessions.reduce((sum, s) => {
    const end = s.clockOutAt ?? now;
    return sum + Math.max(0, end.getTime() - s.clockInAt.getTime());
  }, 0);
}
