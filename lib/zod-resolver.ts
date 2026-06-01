import type { FieldErrors, FieldValues, Resolver } from "react-hook-form";
import type { ZodType } from "zod";

// Minimal react-hook-form resolver for zod (avoids pulling in
// @hookform/resolvers — the schemas here are simple).
export function zodResolver<T extends FieldValues>(
  schema: ZodType<T>,
): Resolver<T> {
  return async (values) => {
    const result = schema.safeParse(values);
    if (result.success) {
      return { values: result.data, errors: {} };
    }
    const errors: FieldErrors<T> = {} as FieldErrors<T>;
    for (const issue of result.error.issues) {
      const key = issue.path[0];
      if (key != null) {
        const k = String(key);
        if (!(k in errors)) {
          (errors as Record<string, unknown>)[k] = {
            type: issue.code ?? "validation",
            message: issue.message,
          };
        }
      }
    }
    return { values: {}, errors };
  };
}
