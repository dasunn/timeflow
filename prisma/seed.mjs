// Plain-JS seed (run with `node prisma/seed.mjs`) so it needs no TS runner.
// Creates a handful of categories and tasks anchored to "today" so the
// calendar and Now panel are populated on first run.
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

function startOfToday() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

// A DateTime `dayOffset` days from today at hour:minute, local time.
function at(dayOffset, hour, minute) {
  const d = startOfToday();
  d.setDate(d.getDate() + dayOffset);
  d.setHours(hour, minute, 0, 0);
  return d;
}

// Current time snapped down to the nearest 30-min slot.
function snapNow() {
  const d = new Date();
  d.setMinutes(d.getMinutes() < 30 ? 0 : 30, 0, 0);
  return d;
}

function addMinutes(date, mins) {
  return new Date(date.getTime() + mins * 60000);
}

async function main() {
  // Idempotent: wipe and re-seed.
  await prisma.clockSession.deleteMany();
  await prisma.task.deleteMany();
  await prisma.category.deleteMany();

  const work = await prisma.category.create({
    data: { name: "Work", color: "#3b82f6" },
  });
  const personal = await prisma.category.create({
    data: { name: "Personal", color: "#10b981" },
  });
  const health = await prisma.category.create({
    data: { name: "Health", color: "#ef4444" },
  });
  const learning = await prisma.category.create({
    data: { name: "Learning", color: "#a855f7" },
  });

  // Completed yesterday, two clock sessions -> demonstrates accumulated time.
  const completed = await prisma.task.create({
    data: {
      description: "Write project proposal",
      categoryId: work.id,
      status: "COMPLETED",
      plannedStart: at(-1, 14, 0),
      plannedEnd: at(-1, 15, 0),
      isLocked: true,
    },
  });
  await prisma.clockSession.createMany({
    data: [
      { taskId: completed.id, clockInAt: at(-1, 14, 0), clockOutAt: at(-1, 14, 30) },
      { taskId: completed.id, clockInAt: at(-1, 14, 35), clockOutAt: at(-1, 15, 0) },
    ],
  });

  // Drag-delayed (dragged to a later slot twice) -> drag counter visible.
  await prisma.task.create({
    data: {
      description: "Refactor billing module",
      categoryId: work.id,
      plannedStart: at(0, 18, 0),
      plannedEnd: at(0, 19, 0),
      dragDelayCount: 2,
    },
  });

  // Auto-overdue with a preset auto counter -> auto indicator visible.
  await prisma.task.create({
    data: {
      description: "Submit expense report",
      categoryId: personal.id,
      plannedStart: at(0, 7, 0),
      plannedEnd: at(0, 7, 30),
      autoDelayCount: 1,
    },
  });

  // Past, both counters 0, never clocked in -> auto-overdue runner bumps it live.
  await prisma.task.create({
    data: {
      description: "Stretch & hydrate",
      categoryId: health.id,
      plannedStart: at(0, 6, 0),
      plannedEnd: at(0, 6, 30),
    },
  });

  // Happening now -> fills the Now panel on first load.
  const nowStart = snapNow();
  await prisma.task.create({
    data: {
      description: "Deep work block",
      categoryId: learning.id,
      plannedStart: nowStart,
      plannedEnd: addMinutes(nowStart, 90),
    },
  });

  // Upcoming later today.
  await prisma.task.create({
    data: {
      description: "Team sync",
      categoryId: work.id,
      plannedStart: at(0, 16, 0),
      plannedEnd: at(0, 17, 0),
    },
  });

  // Tomorrow.
  await prisma.task.create({
    data: {
      description: "Dentist appointment",
      categoryId: health.id,
      plannedStart: at(1, 10, 0),
      plannedEnd: at(1, 11, 0),
    },
  });

  // Cancelled (kept in the data, removed from active flow).
  await prisma.task.create({
    data: {
      description: "Optional webinar",
      categoryId: learning.id,
      status: "CANCELLED",
      plannedStart: at(0, 12, 0),
      plannedEnd: at(0, 12, 30),
    },
  });

  console.log("Seed complete.");
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
