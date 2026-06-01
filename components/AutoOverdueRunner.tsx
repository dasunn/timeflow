"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { runAutoOverdue } from "@/lib/actions/maintenance";

// Lightweight: runs the auto-overdue check on mount and every interval, and
// refreshes only when something actually changed. Renders nothing.
export function AutoOverdueRunner({
  intervalMs = 60_000,
}: {
  intervalMs?: number;
}) {
  const router = useRouter();

  useEffect(() => {
    let active = true;
    const run = async () => {
      try {
        const res = await runAutoOverdue();
        if (active && res.updated > 0) router.refresh();
      } catch {
        // best-effort; ignore transient errors
      }
    };
    run();
    const id = setInterval(run, intervalMs);
    return () => {
      active = false;
      clearInterval(id);
    };
  }, [intervalMs, router]);

  return null;
}
