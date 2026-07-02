"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { dateKey } from "@/lib/domain/streaks";
import { streakSchema } from "@/lib/domain/validation";
import type { ActionResult } from "./tasks";

export async function createStreak(
  name: string,
  color: string,
): Promise<ActionResult> {
  const parsed = streakSchema.safeParse({ name, color });
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid" };
  }
  await prisma.streak.create({ data: parsed.data });
  revalidatePath("/streaks");
  revalidatePath("/dashboard");
  return { ok: true };
}

export async function updateStreak(
  id: string,
  name: string,
  color: string,
): Promise<ActionResult> {
  const parsed = streakSchema.safeParse({ name, color });
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid" };
  }
  await prisma.streak.update({ where: { id }, data: parsed.data });
  revalidatePath("/streaks");
  revalidatePath("/dashboard");
  return { ok: true };
}

export async function deleteStreak(id: string): Promise<ActionResult> {
  await prisma.streak.delete({ where: { id } });
  revalidatePath("/streaks");
  revalidatePath("/dashboard");
  return { ok: true };
}

// Toggle today's completion on/off for a streak.
export async function toggleStreakToday(streakId: string): Promise<ActionResult> {
  const today = dateKey(new Date());
  const existing = await prisma.streakEntry.findUnique({
    where: { streakId_date: { streakId, date: today } },
  });
  if (existing) {
    await prisma.streakEntry.delete({ where: { id: existing.id } });
  } else {
    await prisma.streakEntry.create({ data: { streakId, date: today } });
  }
  revalidatePath("/streaks");
  revalidatePath("/dashboard");
  return { ok: true };
}
