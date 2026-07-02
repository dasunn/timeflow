"use client";

import { useId } from "react";
import { useForm } from "react-hook-form";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { streakSchema, type StreakInput } from "@/lib/domain/validation";
import { zodResolver } from "@/lib/zod-resolver";

export function StreakForm({
  defaultValues,
  submitLabel,
  pending,
  resetAfterSubmit,
  onSubmit,
}: {
  defaultValues?: StreakInput;
  submitLabel: string;
  pending?: boolean;
  resetAfterSubmit?: boolean;
  onSubmit: (values: StreakInput) => void;
}) {
  const uid = useId();
  const initial = defaultValues ?? { name: "", color: "#8b5cf6" };
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<StreakInput>({
    resolver: zodResolver(streakSchema),
    defaultValues: initial,
  });

  return (
    <form
      onSubmit={handleSubmit((values) => {
        onSubmit(values);
        if (resetAfterSubmit) reset({ name: "", color: initial.color });
      })}
      className="flex items-end gap-2"
    >
      <div className="flex-1 space-y-1.5">
        <Label htmlFor={`${uid}-name`}>Name</Label>
        <Input
          id={`${uid}-name`}
          placeholder="e.g. Meditate"
          {...register("name")}
        />
        {errors.name && (
          <p className="text-xs text-destructive">{errors.name.message}</p>
        )}
      </div>
      <div className="space-y-1.5">
        <Label htmlFor={`${uid}-color`}>Color</Label>
        <input
          id={`${uid}-color`}
          type="color"
          className="h-8 w-14 cursor-pointer rounded-lg border border-input bg-transparent p-0.5"
          {...register("color")}
        />
      </div>
      <Button type="submit" disabled={pending}>
        {submitLabel}
      </Button>
    </form>
  );
}
