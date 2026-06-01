# TimeFlow

A single-user, local personal time-management app — a weekly calendar where you
plan tasks, drag them around, and clock real time against them. MVP built to
validate the idea; runs entirely on your machine with one SQLite file.

## Stack

- **Next.js 16** (App Router, Server Actions) + TypeScript
- **Prisma 6** + **SQLite** (`prisma/dev.db`)
- **Tailwind CSS v4** + **shadcn/ui** + lucide-react
- **dnd-kit** for drag-and-drop, **date-fns**, **react-hook-form** + **zod**

## Getting started

```bash
npm install
npx prisma migrate dev      # creates dev.db, applies migrations, seeds
npm run dev                 # http://localhost:3000
```

`npx prisma migrate dev` runs the seed automatically. To reseed later:
`npm run seed`. To reset the DB: `npm run db:reset`.

## Features

- **Weekly calendar** (Mon–Sun, 30-min grid) with prev/next/this-week nav.
  Cards are positioned and sized by their planned start/end.
- **Drag to reschedule** (snaps to 30-min slots). Dragging to a *later* slot
  increments a **drag-delay** counter; dragging earlier never changes it.
- **Auto-overdue**: when a task's end passes with no clock-in, a separate
  **auto-delay** counter is bumped once. The two counters are tracked and shown
  independently — never merged.
- **Now panel**: clock in / out (multiple cycles accumulate), live timer, and
  Complete once clocked out.
- **Locking**: once a task is clocked in or completed it can no longer be
  dragged.
- **Click any empty slot** to create a task; **click a card** for details —
  edit/add/delete time sessions, or cancel/reopen.
- **Categories** (`/categories`): name + color, used to color-code cards.

## Project layout

- `lib/domain/` — core logic (status engine, delay rules, time/grid math)
- `lib/actions/` — server actions (tasks, clock sessions, categories, maintenance)
- `components/calendar/` — calendar grid, drag, day columns, cards
- `components/now-panel/` — the live Now panel
- `prisma/` — schema, migrations, seed
