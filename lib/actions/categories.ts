"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { categorySchema } from "@/lib/domain/validation";
import type { ActionResult } from "./tasks";

export async function createCategory(
  name: string,
  color: string,
): Promise<ActionResult> {
  const parsed = categorySchema.safeParse({ name, color });
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid" };
  }
  await prisma.category.create({ data: parsed.data });
  revalidatePath("/categories");
  revalidatePath("/");
  return { ok: true };
}

export async function updateCategory(
  id: string,
  name: string,
  color: string,
): Promise<ActionResult> {
  const parsed = categorySchema.safeParse({ name, color });
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid" };
  }
  await prisma.category.update({ where: { id }, data: parsed.data });
  revalidatePath("/categories");
  revalidatePath("/");
  return { ok: true };
}

// Deleting a category sets its tasks' categoryId to null (schema onDelete:
// SetNull) — tasks keep their data, just lose the color.
export async function deleteCategory(id: string): Promise<ActionResult> {
  await prisma.category.delete({ where: { id } });
  revalidatePath("/categories");
  revalidatePath("/");
  return { ok: true };
}
