import type { CSSProperties } from "react";
import { SLOT_HEIGHT_PX } from "@/lib/domain/time";

// Layout constants shared across the calendar pieces.
export const GUTTER_PX = 64; // left time-gutter width
export const MIN_COL_PX = 132; // min width of a day column before scrolling
const HOUR_PX = SLOT_HEIGHT_PX * 2;

// Background grid lines: solid on the hour, faint on the half-hour.
export const slotLinesStyle: CSSProperties = {
  backgroundImage: [
    `repeating-linear-gradient(to bottom, var(--border) 0, var(--border) 1px, transparent 1px, transparent ${HOUR_PX}px)`,
    `repeating-linear-gradient(to bottom, transparent 0, transparent ${SLOT_HEIGHT_PX}px, color-mix(in oklab, var(--border) 55%, transparent) ${SLOT_HEIGHT_PX}px, color-mix(in oklab, var(--border) 55%, transparent) ${SLOT_HEIGHT_PX + 1}px, transparent ${SLOT_HEIGHT_PX + 1}px, transparent ${HOUR_PX}px)`,
  ].join(", "),
};
