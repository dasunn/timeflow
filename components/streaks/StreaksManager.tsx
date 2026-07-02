"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { createStreak, updateStreak } from "@/lib/actions/streaks";
import type { StreakWithEntries } from "@/lib/domain/types";
import type { StreakInput } from "@/lib/domain/validation";
import { StreakCard } from "./StreakCard";
import { StreakForm } from "./StreakForm";

export function StreaksManager({
  streaks,
  today,
}: {
  streaks: StreakWithEntries[];
  today: Date;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [editing, setEditing] = useState<StreakWithEntries | null>(null);

  function handleCreate(values: StreakInput) {
    startTransition(async () => {
      await createStreak(values.name, values.color);
      router.refresh();
    });
  }

  function handleUpdate(values: StreakInput) {
    if (!editing) return;
    const id = editing.id;
    startTransition(async () => {
      await updateStreak(id, values.name, values.color);
      router.refresh();
      setEditing(null);
    });
  }

  return (
    <div className="space-y-6">
      <section className="rounded-lg border p-4">
        <h2 className="mb-3 text-sm font-medium text-muted-foreground">
          Add a streak
        </h2>
        <StreakForm
          submitLabel="Add"
          pending={pending}
          resetAfterSubmit
          onSubmit={handleCreate}
        />
      </section>

      {streaks.length === 0 ? (
        <p className="text-sm text-muted-foreground">No streaks yet.</p>
      ) : (
        <ul className="space-y-2">
          {streaks.map((s) => (
            <StreakCard
              key={s.id}
              streak={s}
              today={today}
              onEdit={() => setEditing(s)}
            />
          ))}
        </ul>
      )}

      <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit streak</DialogTitle>
          </DialogHeader>
          {editing && (
            <StreakForm
              key={editing.id}
              defaultValues={{ name: editing.name, color: editing.color }}
              submitLabel="Save"
              pending={pending}
              onSubmit={handleUpdate}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
