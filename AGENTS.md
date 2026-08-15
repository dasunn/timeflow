<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# Deploying (Netlify + Turso)

Production runs on Netlify against a **Turso** database; local dev uses
`prisma/dev.db`. `prisma migrate` only ever writes the local file — it CANNOT
reach a `libsql://` host. So merging a schema change ships code the live
database can't satisfy, and every request fails with `no such column` until the
schema is applied there too. (That is exactly how the app went down on
2026-08-15; see PR #3.)

A release with a schema change is two steps, in this order:

1. apply the schema to Turso — `npm run db:turso`
2. then merge / deploy

`.env` keeps the Turso vars commented out so local dev stays on the file DB.
Point the script at production for one command rather than editing that file:

```
$env:TURSO_DATABASE_URL="libsql://…"; $env:TURSO_AUTH_TOKEN="…"
node prisma/apply-turso-schema.mjs
```

The script creates missing tables (`CREATE TABLE IF NOT EXISTS`) and adds
missing columns itself. It is additive only — it never drops, renames or
retypes anything.

**Keep schema changes additive.** Adding a column is fine. SQLite's
`ALTER TABLE … ADD COLUMN` cannot add a `PRIMARY KEY` or `UNIQUE` column, a
`NOT NULL` without a constant default, or a `DEFAULT CURRENT_TIMESTAMP`, and
nothing here can drop a `NOT NULL` from an existing column — "make this column
nullable" is a hand-written table rebuild against production, not just a Prisma
migration. The script detects those cases and reports them instead of failing
half-applied. Prefer a nullable/defaulted new column over changing an old one.

After changing `prisma/schema.prisma`, regenerate the bootstrap SQL:

```
npx prisma migrate diff --from-empty --to-schema-datamodel prisma/schema.prisma --script
```

and paste the result into `prisma/turso-schema.sql` (keep its header comment).

# Task invariants

- **Backlog rows are not scheduled work.** A `Task` with `isBacklog` set carries
  a zero-length placeholder `plannedStart`/`plannedEnd` that must NEVER be read
  as a schedule. Every query about scheduled work filters `isBacklog: false` —
  the `SCHEDULED` constant in `lib/data.ts`, plus `runAutoOverdue`
  (`lib/actions/maintenance.ts`) and `claimDueReminders`
  (`lib/actions/reminders.ts`). Miss one and the whole backlog is marked overdue
  on the next tick. Any new task query must opt in to the same filter.
- **Repeats are materialised, not modelled.** Each occurrence is an independent
  `Task` row and nothing links them, so there is no series to edit or delete as
  a unit. The rule is expanded CLIENT-side (`lib/domain/recurrence.ts`) because
  the occurrences must land on the user's local calendar days and the server may
  run in UTC; the action receives concrete windows, caps them at
  `MAX_OCCURRENCES`, and writes them in one transaction.
