"use client";

import { useId } from "react";
import { useForm } from "react-hook-form";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { categorySchema, type CategoryInput } from "@/lib/domain/validation";
import { zodResolver } from "@/lib/zod-resolver";

export function CategoryForm({
  defaultValues,
  submitLabel,
  pending,
  resetAfterSubmit,
  onSubmit,
}: {
  defaultValues?: CategoryInput;
  submitLabel: string;
  pending?: boolean;
  resetAfterSubmit?: boolean;
  onSubmit: (values: CategoryInput) => void;
}) {
  const uid = useId();
  const initial = defaultValues ?? { name: "", color: "#6366f1" };
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<CategoryInput>({
    resolver: zodResolver(categorySchema),
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
          placeholder="e.g. Deep work"
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
