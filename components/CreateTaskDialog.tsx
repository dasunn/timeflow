"use client";

import { addMonths, format } from "date-fns";
import { BellIcon, RepeatIcon } from "lucide-react";
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
import { Switch } from "@/components/ui/switch";
import { createTask } from "@/lib/actions/tasks";
import {
  MAX_OCCURRENCES,
  repeatDays,
  repeatOccurrences,
  REPEAT_FREQUENCIES,
  REPEAT_FREQUENCY_LABELS,
  WEEKDAY_OPTIONS,
  type RepeatRule,
} from "@/lib/domain/recurrence";
import {
  DEFAULT_REMINDER_MINUTES,
  parseReminderValue,
  REMINDER_CHOICES,
} from "@/lib/domain/reminders";
import {
  dateAtMinutes,
  dateFromInput,
  formatDuration,
  MINUTES_PER_DAY,
  minutesToTime as hhmm,
  timeToMinutes as toMinutes,
  toDateInput,
} from "@/lib/domain/time";
import type { Category } from "@/lib/domain/types";
import { ensureNotificationPermission } from "@/lib/notifications";
import { zodResolver } from "@/lib/zod-resolver";

// Latest time a native time picker accepts (23:59); tasks render by exact
// minute so any value in [00:00, 23:59] positions correctly.
const DAY_END_MAX = MINUTES_PER_DAY - 1;

// How far the "Until" date sits ahead of the start when repeat is switched on.
const DEFAULT_REPEAT_MONTHS = 1;

const MONTH_DAYS = Array.from({ length: 31 }, (_, i) => i + 1);

const schema = z
  .object({
    description: z.string().trim().min(1, "Description is required").max(500),
    categoryId: z.string(),
    date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Pick a date"),
    startTime: z.string().regex(/^\d{2}:\d{2}$/, "Pick a start time"),
    endTime: z.string().regex(/^\d{2}:\d{2}$/, "Pick an end time"),
    notifyMinutesBefore: z.number().nullable(),
    // Repeat is off by default; the fields below only matter once it's on.
    repeat: z.boolean(),
    frequency: z.enum(REPEAT_FREQUENCIES),
    weekdays: z.array(z.number()), // WEEKLY — Date.getDay() values
    monthDay: z.number(), // MONTHLY — 1..31
    repeatUntil: z.string(),
  })
  .refine((v) => toMinutes(v.endTime) > toMinutes(v.startTime), {
    message: "End must be after start",
    path: ["endTime"],
  })
  .superRefine((v, ctx) => {
    if (!v.repeat) return;

    if (v.frequency === "WEEKLY" && v.weekdays.length === 0) {
      ctx.addIssue({
        code: "custom",
        message: "Pick at least one day",
        path: ["weekdays"],
      });
      return;
    }

    const from = dateFromInput(v.date);
    const until = dateFromInput(v.repeatUntil);
    if (Number.isNaN(until.getTime())) {
      ctx.addIssue({
        code: "custom",
        message: "Pick an end date",
        path: ["repeatUntil"],
      });
      return;
    }
    if (until < from) {
      ctx.addIssue({
        code: "custom",
        message: "End date must be on or after the start date",
        path: ["repeatUntil"],
      });
      return;
    }

    const count = repeatDays(toRule(v), from, until).length;
    if (count === 0) {
      ctx.addIssue({
        code: "custom",
        message: "No dates match — widen the range",
        path: ["repeatUntil"],
      });
    } else if (count > MAX_OCCURRENCES) {
      ctx.addIssue({
        code: "custom",
        message: `Over ${MAX_OCCURRENCES} tasks — shorten the range`,
        path: ["repeatUntil"],
      });
    }
  });
type Values = z.infer<typeof schema>;

function toRule(v: Pick<Values, "frequency" | "weekdays" | "monthDay">): RepeatRule {
  return { frequency: v.frequency, weekdays: v.weekdays, monthDay: v.monthDay };
}

const SELECT_CLASS =
  "h-8 w-full rounded-lg border border-input bg-transparent px-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-input/30";

// Where the dialog starts from: a clicked grid slot, or an existing task being
// duplicated (same description/category/reminder, times pre-filled but free to
// change before creating).
export type CreateTaskTarget = {
  day: Date;
  startMinutes: number;
  endMinutes?: number;
  duplicateOf?: {
    description: string;
    categoryId: string | null;
    notifyMinutesBefore: number | null;
  };
};

export function CreateTaskDialog({
  target,
  categories,
  onClose,
}: {
  target: CreateTaskTarget;
  categories: Category[];
  onClose: () => void;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(true);
  const [pending, startTransition] = useTransition();
  const [serverError, setServerError] = useState<string | null>(null);

  const duplicate = target.duplicateOf;
  const defaultEnd = Math.min(
    target.endMinutes ?? target.startMinutes + 60,
    DAY_END_MAX,
  );

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors },
  } = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: {
      description: duplicate?.description ?? "",
      categoryId: duplicate?.categoryId ?? "",
      date: toDateInput(target.day),
      startTime: hhmm(target.startMinutes),
      endTime: hhmm(defaultEnd),
      notifyMinutesBefore:
        duplicate?.notifyMinutesBefore !== undefined
          ? duplicate.notifyMinutesBefore
          : DEFAULT_REMINDER_MINUTES,
      repeat: false,
      frequency: "WEEKLY",
      weekdays: [target.day.getDay()],
      monthDay: target.day.getDate(),
      repeatUntil: toDateInput(addMonths(target.day, DEFAULT_REPEAT_MONTHS)),
    },
  });

  const startField = register("startTime");
  const dateField = register("date");
  const reminderField = register("notifyMinutesBefore", {
    setValueAs: parseReminderValue,
  });

  // Start defaults to the clicked slot but is freely editable; show the live
  // duration and keep the end after the start.
  const date = watch("date");
  const startTime = watch("startTime");
  const endTime = watch("endTime");
  const durationMin = toMinutes(endTime) - toMinutes(startTime);

  const repeat = watch("repeat");
  const frequency = watch("frequency");
  const weekdays = watch("weekdays");
  const monthDay = watch("monthDay");
  const repeatUntil = watch("repeatUntil");

  // Live preview of what "Create" will actually make. Same expansion the
  // submit path uses, so the count on screen is the count written.
  const occurrenceDays = repeat
    ? repeatDays(
        { frequency, weekdays, monthDay },
        dateFromInput(date),
        dateFromInput(repeatUntil),
      )
    : [];
  const taskCount = repeat ? occurrenceDays.length : 1;

  function toggleWeekday(index: number) {
    const next = weekdays.includes(index)
      ? weekdays.filter((d) => d !== index)
      : [...weekdays, index].sort((a, b) => a - b);
    setValue("weekdays", next, { shouldValidate: true });
  }

  function close(value: boolean) {
    setOpen(value);
    if (!value) onClose();
  }

  function onSubmit(values: Values) {
    setServerError(null);
    if (values.notifyMinutesBefore !== null) ensureNotificationPermission();

    const day = dateFromInput(values.date);
    const startMinutes = toMinutes(values.startTime);
    const endMinutes = toMinutes(values.endTime);

    // Occurrences are expanded here, in the browser's time zone, so the days
    // land where the user sees them regardless of where the server runs.
    const occurrences = values.repeat
      ? repeatOccurrences({
          rule: toRule(values),
          from: day,
          until: dateFromInput(values.repeatUntil),
          startMinutes,
          endMinutes,
        })
      : [
          {
            startMs: dateAtMinutes(day, startMinutes).getTime(),
            endMs: dateAtMinutes(day, endMinutes).getTime(),
          },
        ];

    const [first, ...rest] = occurrences;
    if (!first) {
      setServerError("No dates match this repeat");
      return;
    }

    startTransition(async () => {
      const res = await createTask({
        description: values.description,
        categoryId: values.categoryId || null,
        plannedStartMs: first.startMs,
        plannedEndMs: first.endMs,
        notifyMinutesBefore: values.notifyMinutesBefore,
        repeatOccurrences: rest,
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
          <DialogTitle>{duplicate ? "Duplicate task" : "New task"}</DialogTitle>
          <DialogDescription>
            {duplicate
              ? "A copy — change anything before creating it."
              : format(target.day, "EEEE, MMM d")}
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

          <div className="space-y-1.5">
            <Label htmlFor="date">Date</Label>
            <Input
              id="date"
              type="date"
              {...dateField}
              onChange={(e) => {
                dateField.onChange(e);
                const next = dateFromInput(e.target.value);
                if (Number.isNaN(next.getTime())) return;
                const previous = dateFromInput(date);
                // Follow the date with the repeat defaults, but only while they
                // still mirror it — an edited weekday/day-of-month is left alone.
                if (weekdays.length === 1 && weekdays[0] === previous.getDay()) {
                  setValue("weekdays", [next.getDay()], { shouldValidate: true });
                }
                if (monthDay === previous.getDate()) {
                  setValue("monthDay", next.getDate(), { shouldValidate: true });
                }
                if (dateFromInput(repeatUntil) < next) {
                  setValue(
                    "repeatUntil",
                    toDateInput(addMonths(next, DEFAULT_REPEAT_MONTHS)),
                    { shouldValidate: true },
                  );
                }
              }}
            />
            {errors.date && (
              <p className="text-xs text-destructive">{errors.date.message}</p>
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

          {/* Repeat — off by default. Turning it on creates one independent
              task per matching date, all at the same time of day. */}
          <div className="space-y-3 rounded-lg border p-2.5">
            <div className="flex items-center justify-between gap-2">
              <Label
                htmlFor="repeat"
                className="flex items-center gap-1.5 text-sm font-medium"
              >
                <RepeatIcon className="size-3.5 text-muted-foreground" />
                Repeat
              </Label>
              <Switch
                id="repeat"
                aria-label="Repeat"
                checked={repeat}
                onCheckedChange={(checked) =>
                  setValue("repeat", checked, { shouldValidate: true })
                }
              />
            </div>

            {repeat && (
              <>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label htmlFor="frequency">How often</Label>
                    <select
                      id="frequency"
                      className={SELECT_CLASS}
                      {...register("frequency")}
                    >
                      {REPEAT_FREQUENCIES.map((f) => (
                        <option key={f} value={f}>
                          {REPEAT_FREQUENCY_LABELS[f]}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="repeatUntil">Until</Label>
                    <Input
                      id="repeatUntil"
                      type="date"
                      min={date}
                      {...register("repeatUntil")}
                    />
                  </div>
                </div>

                {frequency === "WEEKLY" && (
                  <div className="space-y-1.5">
                    <Label>On these days</Label>
                    <div className="flex gap-1">
                      {WEEKDAY_OPTIONS.map((d) => {
                        const on = weekdays.includes(d.index);
                        return (
                          <Button
                            key={d.index}
                            type="button"
                            size="icon-sm"
                            variant={on ? "default" : "outline"}
                            aria-pressed={on}
                            aria-label={d.label}
                            title={d.label}
                            onClick={() => toggleWeekday(d.index)}
                          >
                            {d.short}
                          </Button>
                        );
                      })}
                    </div>
                    {errors.weekdays && (
                      <p className="text-xs text-destructive">
                        {errors.weekdays.message}
                      </p>
                    )}
                  </div>
                )}

                {frequency === "MONTHLY" && (
                  <div className="space-y-1.5">
                    <Label htmlFor="monthDay">Day of the month</Label>
                    <select
                      id="monthDay"
                      className={SELECT_CLASS}
                      {...register("monthDay", { valueAsNumber: true })}
                    >
                      {MONTH_DAYS.map((d) => (
                        <option key={d} value={d}>
                          {d}
                        </option>
                      ))}
                    </select>
                    {monthDay > 28 && (
                      <p className="text-[11px] text-muted-foreground">
                        Months without a {monthDay}
                        {monthDay === 31 ? "st" : "th"} are skipped.
                      </p>
                    )}
                  </div>
                )}

                {errors.repeatUntil ? (
                  <p className="text-xs text-destructive">
                    {errors.repeatUntil.message}
                  </p>
                ) : (
                  occurrenceDays.length > 0 && (
                    <p className="text-xs text-muted-foreground">
                      {occurrenceDays.length} task
                      {occurrenceDays.length === 1 ? "" : "s"} ·{" "}
                      {format(occurrenceDays[0], "MMM d")} –{" "}
                      {format(
                        occurrenceDays[occurrenceDays.length - 1],
                        "MMM d",
                      )}
                    </p>
                  )
                )}
              </>
            )}
          </div>

          {serverError && (
            <p className="text-xs text-destructive">{serverError}</p>
          )}

          <DialogFooter>
            <DialogClose render={<Button type="button" variant="outline" />}>
              Cancel
            </DialogClose>
            <Button type="submit" disabled={pending}>
              {taskCount > 1 ? `Create ${taskCount} tasks` : "Create task"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
