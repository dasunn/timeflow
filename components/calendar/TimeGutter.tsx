import { SLOT_HEIGHT_PX, SLOTS_PER_DAY, slotLabel } from "@/lib/domain/time";
import { GUTTER_PX } from "./grid";

export function TimeGutter() {
  return (
    <div
      className="sticky left-0 z-20 shrink-0 bg-background"
      style={{ width: GUTTER_PX }}
    >
      {Array.from({ length: SLOTS_PER_DAY }).map((_, i) => (
        <div key={i} style={{ height: SLOT_HEIGHT_PX }} className="relative">
          {i % 2 === 0 && (
            <span className="absolute top-0 right-1.5 text-[10px] leading-none text-muted-foreground tabular-nums">
              {slotLabel(i)}
            </span>
          )}
        </div>
      ))}
    </div>
  );
}
