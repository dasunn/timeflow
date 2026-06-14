import { PauseIcon } from "lucide-react";
import type { TaskStatus } from "@/lib/domain/types";
import { cn } from "@/lib/utils";
import { STATUS_META } from "./status-meta";

// A "live" dot with an expanding ping ring. Emerald for a running task; red
// for an overdue (pending) one.
function LiveDot({ tone = "emerald" }: { tone?: "emerald" | "red" }) {
  const color = tone === "red" ? "bg-red-500" : "bg-emerald-500";
  return (
    <span className="relative flex size-1.5">
      <span
        className={cn(
          "absolute inline-flex size-full animate-ping rounded-full opacity-75",
          color,
        )}
      />
      <span className={cn("relative inline-flex size-1.5 rounded-full", color)} />
    </span>
  );
}

export function StatusBadge({
  status,
  size = "sm",
  className,
}: {
  status: TaskStatus;
  size?: "xs" | "sm";
  className?: string;
}) {
  const meta = STATUS_META[status];
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center gap-1 rounded font-medium leading-tight",
        size === "xs" ? "px-1 text-[9px]" : "px-1.5 py-0.5 text-[11px]",
        meta.className,
        className,
      )}
    >
      {status === "RUNNING" && <LiveDot />}
      {status === "PENDING" && <LiveDot tone="red" />}
      {status === "PAUSED" && (
        <PauseIcon className={size === "xs" ? "size-2.5" : "size-3"} />
      )}
      {meta.label}
    </span>
  );
}
