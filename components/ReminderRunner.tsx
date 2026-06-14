"use client";

import { useEffect } from "react";
import { claimDueReminders } from "@/lib/actions/reminders";
import { reminderNotification } from "@/lib/domain/reminders";

// Polls for due task reminders and fires a browser notification for each.
// Only claims when permission is granted, so reminders aren't consumed while
// notifications are off (the claim marks them fired). Renders nothing.
export function ReminderRunner({
  intervalMs = 30_000,
}: {
  intervalMs?: number;
}) {
  useEffect(() => {
    if (typeof window === "undefined" || !("Notification" in window)) return;

    let active = true;
    const run = async () => {
      if (Notification.permission !== "granted") return;
      try {
        const due = await claimDueReminders();
        if (!active) return;
        const now = Date.now();
        for (const r of due) {
          const { title, body } = reminderNotification(
            r.description,
            r.plannedStartMs,
            now,
          );
          new Notification(title, { body, tag: `task-${r.id}` });
        }
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
  }, [intervalMs]);

  return null;
}
