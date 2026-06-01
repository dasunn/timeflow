"use client";

import { createContext, useContext, useEffect, useState } from "react";

const NowContext = createContext<Date>(new Date(0));

// Provides a "current time" that ticks on an interval. Initialized from a
// server-provided timestamp so the SSR and first client render match (no
// hydration mismatch); the client then advances it.
export function NowProvider({
  initial,
  intervalMs = 30_000,
  children,
}: {
  initial: number;
  intervalMs?: number;
  children: React.ReactNode;
}) {
  const [now, setNow] = useState(() => new Date(initial));

  useEffect(() => {
    const tick = () => setNow(new Date());
    tick(); // sync to real time right after hydration
    const id = setInterval(tick, intervalMs);
    return () => clearInterval(id);
  }, [intervalMs]);

  return <NowContext.Provider value={now}>{children}</NowContext.Provider>;
}

export function useNow(): Date {
  return useContext(NowContext);
}
