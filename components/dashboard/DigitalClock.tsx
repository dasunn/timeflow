"use client";

import { format } from "date-fns";
import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";

// Defined in globals.css. Each is a one-shot flourish the clock wears for a
// beat; `null` is the resting state.
const EFFECTS = [
  "clock-fx-glitch",
  "clock-fx-sweep",
  "clock-fx-pop",
  "clock-fx-hue",
] as const;

type Effect = (typeof EFFECTS)[number];

// How long to wait between flourishes. Randomised inside this band so the
// animation reads as spontaneous rather than metronomic.
const IDLE_MIN_MS = 12_000;
const IDLE_MAX_MS = 40_000;
const EFFECT_MS = 1_800;

export function DigitalClock({ serverNow }: { serverNow: number }) {
  // Seeded from the server clock so the first client render matches the SSR
  // HTML, then ticks on its own.
  const [now, setNow] = useState(() => new Date(serverNow));
  const [effect, setEffect] = useState<Effect | null>(null);

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  // One self-rescheduling timeout rather than an interval: the gap is a fresh
  // random value each round, and the effect class is cleared before the next
  // one is scheduled so two can never overlap.
  useEffect(() => {
    let effectTimer: ReturnType<typeof setTimeout>;
    let idleTimer: ReturnType<typeof setTimeout>;

    const schedule = () => {
      const gap = IDLE_MIN_MS + Math.random() * (IDLE_MAX_MS - IDLE_MIN_MS);
      idleTimer = setTimeout(() => {
        setEffect(EFFECTS[Math.floor(Math.random() * EFFECTS.length)]);
        effectTimer = setTimeout(() => {
          setEffect(null);
          schedule();
        }, EFFECT_MS);
      }, gap);
    };

    schedule();
    return () => {
      clearTimeout(idleTimer);
      clearTimeout(effectTimer);
    };
  }, []);

  return (
    <div
      className="flex shrink-0 items-center gap-2 rounded-xl border border-input bg-card/60 px-2.5 py-1 shadow-sm backdrop-blur-sm"
      // The seconds change every tick; announcing that would be relentless.
      aria-hidden
    >
      <span
        className={cn(
          "font-mono text-lg leading-none font-semibold tracking-tight tabular-nums",
          effect,
        )}
      >
        {format(now, "HH:mm")}
        <span className="text-muted-foreground">:{format(now, "ss")}</span>
      </span>
      <span className="flex flex-col text-[9px] leading-[1.15] font-medium tracking-widest text-muted-foreground uppercase">
        <span>{format(now, "EEE")}</span>
        <span>{format(now, "dd MMM")}</span>
      </span>
    </div>
  );
}
