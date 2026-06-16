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
import {
  dateAtMinutes,
  formatDuration,
  MINUTES_PER_DAY,
  minutesToTime as hhmm,
  timeToMinutes as toMinutes,
} from "@/lib/domain/time";
import type { Category } from "@/lib/domain/types";
import { ensureNotificationPermission } from "@/lib/notifications";
import { zodResolver } from "@/lib/zod-resolver";

// Latest time a native time picker accepts (23:59); tasks render by exact
// minute so any value in [00:00, 23:59] positions correctly.
const DAY_END_MAX = MINUTES_PER_DAY - 1;

const schema = z
  .object({
    description: z.string().trim().min(1, "Description is required").max(500),
    categoryId: z.string(),
    startTime: z.string().regex(/^\d{2}:\d{2}$/, "Pick a start time"),
    endTime: z.string().regex(/^\d{2}:\d{2}$/, "Pick an end time"),
    notifyMinutesBefore: z.number().nullable(),
  })
  .refine((v) => toMinutes(v.endTime) > toMinutes(v.startTime), {
    message: "End must be after start",
    path: ["endTime"],
  });
type Values = z.infer<typeof schema>;

const SELECT_CLASS =
  "h-8 w-full rounded-lg border border-input bg-transparent px-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-input/30";

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

  const defaultEnd = Math.min(target.startMinutes + 60, DAY_END_MAX);

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors },
  } = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: {
      description: "",
      categoryId: "",
      startTime: hhmm(target.startMinutes),
      endTime: hhmm(defaultEnd),
      notifyMinutesBefore: DEFAULT_REMINDER_MINUTES,
    },
  });

  const startField = register("startTime");
  const reminderField = register("notifyMinutesBefore", {
    setValueAs: parseReminderValue,
  });

  // Start defaults to the clicked slot but is freely editable; show the live
  // duration and keep the end after the start.
  const startTime = watch("startTime");
  const endTime = watch("endTime");
  const durationMin = toMinutes(endTime) - toMinutes(startTime);

  function close(value: boolean) {
    setOpen(value);
    if (!value) onClose();
  }

  function onSubmit(values: Values) {
    setServerError(null);
    if (values.notifyMinutesBefore !== null) ensureNotificationPermission();
    startTransition(async () => {
      const startMs = dateAtMinutes(
        target.day,
        toMinutes(values.startTime),
      ).getTime();
      const endMs = dateAtMinutes(
        target.day,
        toMinutes(values.endTime),
      ).getTime();
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
            {format(target.day, "EEEE, MMM d")}
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
              <Label htmlFor="startTime">Starts</Label>
              <Input
                id="startTime"
                type="time"
                {...startField}
                onChange={(e) => {
                  startField.onChange(e);
                  // Keep the end after the start: bump it forward if overtaken.
                  const s = toMinutes(e.target.value);
                  if (e.target.value && toMinutes(endTime) <= s) {
                    setValue("endTime", hhmm(Math.min(s + 60, DAY_END_MAX)), {
                      shouldValidate: true,
                    });
                  }
                }}
              />
            </div>

            <div className="space-y-1.5">
              <Label
                htmlFor="endTime"
                className="flex items-center justify-between"
              >
                <span>Ends</span>
                {durationMin > 0 && (
                  <span className="text-[11px] font-normal text-muted-foreground tabular-nums">
                    {formatDuration(durationMin * 60_000)}
                  </span>
                )}
              </Label>
              <Input id="endTime" type="time" {...register("endTime")} />
              {errors.endTime && (
                <p className="text-xs text-destructive">
                  {errors.endTime.message}
                </p>
              )}
            </div>
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
              <Label
                htmlFor="notifyMinutesBefore"
                className="flex items-center gap-1.5"
              >
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
