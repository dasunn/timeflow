"use client";

import { ChevronRightIcon, LoaderCircleIcon } from "lucide-react";
import { useCallback, useRef, useState } from "react";
import { cn } from "@/lib/utils";

// Fraction of the track the thumb must reach before the action fires. High
// enough that a stray brush doesn't clock you in, low enough that you don't
// have to jam the thumb into the end stop.
const CONFIRM_AT = 0.82;

// Keyboard equivalent: three presses of ArrowRight crosses CONFIRM_AT, so the
// control still takes a deliberate gesture without a pointer.
const KEY_STEP = 0.34;

// Thumb size and track padding in px. Constants because the same two numbers
// set the thumb's travel in both the drag maths and its `left` calc.
const THUMB_PX = 32;
const TRACK_PAD_PX = 6;

export function SwipeToStart({
  label,
  busyLabel,
  color,
  disabled = false,
  onConfirm,
}: {
  label: string;
  busyLabel: string;
  /** Track fill + thumb tint. Usually the task's category colour. */
  color: string;
  disabled?: boolean;
  onConfirm: () => void;
}) {
  const trackRef = useRef<HTMLDivElement>(null);
  const startXRef = useRef(0);
  const [progress, setProgress] = useState(0);
  const [dragging, setDragging] = useState(false);
  const [busy, setBusy] = useState(false);

  // Travel is the track width minus the thumb, so progress 1 lands the thumb
  // flush against the right end rather than overshooting it.
  const travelPx = useCallback(() => {
    const track = trackRef.current;
    if (!track) return 1;
    return Math.max(1, track.clientWidth - THUMB_PX - 2 * TRACK_PAD_PX);
  }, []);

  const fire = useCallback(() => {
    setBusy(true);
    setProgress(1);
    onConfirm();
  }, [onConfirm]);

  const settle = useCallback(
    (p: number) => {
      if (p >= CONFIRM_AT) fire();
      else setProgress(0);
    },
    [fire],
  );

  function onPointerDown(e: React.PointerEvent<HTMLDivElement>) {
    if (disabled || busy) return;
    // Capture on the track, not the thumb: the pointer will outrun the thumb
    // on a fast swipe, and without capture the move events go to whatever is
    // under the cursor instead.
    e.currentTarget.setPointerCapture(e.pointerId);
    startXRef.current = e.clientX;
    setDragging(true);
  }

  function onPointerMove(e: React.PointerEvent<HTMLDivElement>) {
    if (!dragging) return;
    const dx = e.clientX - startXRef.current;
    setProgress(Math.min(1, Math.max(0, dx / travelPx())));
  }

  function onPointerUp(e: React.PointerEvent<HTMLDivElement>) {
    if (!dragging) return;
    e.currentTarget.releasePointerCapture(e.pointerId);
    setDragging(false);
    settle(progress);
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLDivElement>) {
    if (disabled || busy) return;
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      fire();
    } else if (e.key === "ArrowRight") {
      e.preventDefault();
      const next = Math.min(1, progress + KEY_STEP);
      if (next >= CONFIRM_AT) fire();
      else setProgress(next);
    } else if (e.key === "ArrowLeft") {
      e.preventDefault();
      setProgress(Math.max(0, progress - KEY_STEP));
    }
  }

  const armed = progress >= CONFIRM_AT;

  return (
    <div
      ref={trackRef}
      role="button"
      tabIndex={disabled ? -1 : 0}
      aria-label={label}
      aria-disabled={disabled || busy}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
      onKeyDown={onKeyDown}
      onBlur={() => !busy && setProgress(0)}
      className={cn(
        "relative isolate flex h-11 items-center overflow-hidden rounded-full border select-none",
        "bg-background/70 backdrop-blur-sm",
        // touch-none: without it the browser claims the horizontal drag for
        // scrolling and the thumb never moves on a touchscreen.
        "touch-none outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
        disabled ? "cursor-not-allowed opacity-50" : "cursor-grab",
        dragging && "cursor-grabbing",
      )}
      style={{ borderColor: `color-mix(in oklab, ${color} 45%, transparent)` }}
    >
      {/* Fill trailing the thumb. */}
      <div
        className={cn(
          "absolute inset-y-0 left-0 -z-10",
          !dragging && "transition-[width] duration-300 ease-out",
        )}
        style={{
          width: `calc(${progress * 100}% )`,
          background: `linear-gradient(90deg, color-mix(in oklab, ${color} 18%, transparent), color-mix(in oklab, ${color} 42%, transparent))`,
        }}
      />

      <span
        className={cn(
          "pointer-events-none absolute inset-0 flex items-center justify-center gap-1.5 text-sm font-medium transition-opacity",
          // Fade the instruction out as the thumb travels over it.
          progress > 0.25 ? "opacity-0" : "opacity-100",
        )}
      >
        {busy ? busyLabel : label}
      </span>

      {busy && (
        <span className="pointer-events-none absolute inset-0 flex items-center justify-center gap-2 text-sm font-medium">
          <LoaderCircleIcon className="size-4 animate-spin" />
          {busyLabel}
        </span>
      )}

      {/* Thumb. */}
      <div
        className={cn(
          "absolute top-1/2 flex size-8 -translate-y-1/2 items-center justify-center rounded-full text-white shadow-md",
          !dragging && "transition-[left] duration-300 ease-out",
        )}
        style={{
          left: `calc(${TRACK_PAD_PX}px + ${progress} * (100% - ${THUMB_PX + 2 * TRACK_PAD_PX}px))`,
          backgroundColor: color,
        }}
      >
        <ChevronRightIcon
          className={cn(
            "size-4 transition-transform",
            armed && "scale-125",
            // Idle nudge: hints the affordance without a separate arrow row.
            !dragging && !busy && progress === 0 && "animate-pulse",
          )}
        />
      </div>
    </div>
  );
}
