"use client";

import { format } from "date-fns";
import { BellIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createTask } from "@/lib/actions/tasks";
import {
  DEFAULT_REMINDER_MINUTES,
  parseReminderValue,
  REMINDER_CHOICES,
} from "@/lib/domain/reminders";
import { dateAtMinutes, formatDuration, MINUTES_PER_DAY } from "@/lib/domain/time";
import type { Category } from "@/lib/domain/types";
import { ensureNotificationPermission } from "@/lib/notifications";
import { zodResolver } from "@/lib/zod-resolver";

const schema = z.object({
  description: z.string().trim().min(1, "Description is required").max(500),
  categoryId: z.string(),
  endMinutes: z.number(),
  notifyMinutesBefore: z.number().nullable(),
});
type Values = z.infer<typeof schema>;

const SELECT_CLASS =
  "h-8 w-full rounded-lg border border-input bg-transparent px-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-input/30";

function hhmm(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

export function CreateTaskDialog({
  target,
  categories,
  onClose,
}: {
  target: { day: Date; startMinutes: number };
  categories: Category[];
  onClose: () => void;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(true);
  const [pending, startTransition] = useTransition();
  const [serverError, setServerError] = useState<string | null>(null);

  const defaultEnd = Math.min(target.startMinutes + 60, MINUTES_PER_DAY);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: {
      description: "",
      categoryId: "",
      endMinutes: defaultEnd,
      notifyMinutesBefore: DEFAULT_REMINDER_MINUTES,
    },
  });

  const reminderField = register("notifyMinutesBefore", {
    setValueAs: parseReminderValue,
  });

  const endOptions: { value: number; label: string }[] = [];
  for (let m = target.startMinutes + 30; m <= MINUTES_PER_DAY; m += 30) {
    endOptions.push({
      value: m,
      label: `${hhmm(m)} (${formatDuration((m - target.startMinutes) * 60_000)})`,
    });
  }

  function close(value: boolean) {
    setOpen(value);
    if (!value) onClose();
  }

  function onSubmit(values: Values) {
    setServerError(null);
    if (values.notifyMinutesBefore !== null) ensureNotificationPermission();
    startTransition(async () => {
      const startMs = dateAtMinutes(target.day, target.startMinutes).getTime();
      const endMs = dateAtMinutes(target.day, values.endMinutes).getTime();
      const res = await createTask({
        description: values.description,
        categoryId: values.categoryId || null,
        plannedStartMs: startMs,
        plannedEndMs: endMs,
        notifyMinutesBefore: values.notifyMinutesBefore,
      });
      if (res.ok) {
        close(false);
        router.refresh();
      } else {
        setServerError(res.error);
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={close}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>New task</DialogTitle>
          <DialogDescription>
            {format(target.day, "EEEE, MMM d")} · starts {hhmm(target.startMinutes)}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="description">Description</Label>
            <Input
              id="description"
              autoFocus
              placeholder="What are you working on?"
              {...register("description")}
            />
            {errors.description && (
              <p className="text-xs text-destructive">
                {errors.description.message}
              </p>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="categoryId">Category</Label>
              <select
                id="categoryId"
                className={SELECT_CLASS}
                {...register("categoryId")}
              >
                <option value="">No category</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="endMinutes">Ends</Label>
              <select
                id="endMinutes"
                className={SELECT_CLASS}
                {...register("endMinutes", { valueAsNumber: true })}
              >
                {endOptions.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="notifyMinutesBefore" className="flex items-center gap-1.5">
              <BellIcon className="size-3.5 text-muted-foreground" />
              Reminder
            </Label>
            <select
              id="notifyMinutesBefore"
              className={SELECT_CLASS}
              {...reminderField}
              onChange={(e) => {
                reminderField.onChange(e);
                if (e.target.value !== "off") ensureNotificationPermission();
              }}
            >
              <option value="off">No reminder</option>
              {REMINDER_CHOICES.map((m) => (
                <option key={m} value={m}>
                  {m} minutes before
                </option>
              ))}
            </select>
          </div>

          {serverError && (
            <p className="text-xs text-destructive">{serverError}</p>
          )}

          <DialogFooter>
            <DialogClose render={<Button type="button" variant="outline" />}>
              Cancel
            </DialogClose>
            <Button type="submit" disabled={pending}>
              Create task
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
