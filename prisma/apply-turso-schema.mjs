// Applies prisma/turso-schema.sql to the Turso database named by
// TURSO_DATABASE_URL / TURSO_AUTH_TOKEN in .env. Run with `npm run db:turso`.
//
// This exists so the schema can be created without installing the Turso CLI,
// which on Windows requires WSL. It only creates tables that don't exist yet, so
// running it twice on an already-populated database is a no-op, not a wipe.
//
// It then adds any columns the live tables are missing — CREATE TABLE IF NOT
// EXISTS can't, and a deploy whose schema gained a column dies on every request
// with "no such column" until they're there. Additive only: nothing is dropped,
// renamed or retyped.
//
// To point it at production without touching .env (whose Turso vars stay
// commented out so local dev keeps using the file DB), set the vars for the one
// command:
//   $env:TURSO_DATABASE_URL="libsql://…"; $env:TURSO_AUTH_TOKEN="…"
//   node prisma/apply-turso-schema.mjs
import { createClient } from "@libsql/client";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

const url = process.env.TURSO_DATABASE_URL;
const authToken = process.env.TURSO_AUTH_TOKEN;

if (!url) {
  console.error(
    "TURSO_DATABASE_URL is not set.\n" +
      "Add it (and TURSO_AUTH_TOKEN) to .env, copying the values from your\n" +
      "Turso dashboard, then run this again.",
  );
  process.exit(1);
}

const sql = await readFile(
  fileURLToPath(new URL("./turso-schema.sql", import.meta.url)),
  "utf8",
);

// `CREATE TABLE "X"` -> `CREATE TABLE IF NOT EXISTS "X"`, so re-running is safe.
const idempotentSql = sql
  .replace(/CREATE TABLE (?!IF NOT EXISTS)/g, "CREATE TABLE IF NOT EXISTS ")
  .replace(
    /CREATE UNIQUE INDEX (?!IF NOT EXISTS)/g,
    "CREATE UNIQUE INDEX IF NOT EXISTS ",
  );

const client = createClient({ url, authToken });

// Expected columns per table, parsed out of the SQL above — each as
// { name, definition }, where the definition is the column's line verbatim
// (`"isBacklog" BOOLEAN NOT NULL DEFAULT false`). CREATE TABLE IF NOT EXISTS
// leaves an already-existing table alone, so a table created from an older
// version of this file keeps its old shape and the app fails at query time
// with "no such column" — which is what the drift pass below repairs.
function expectedColumns(schemaSql) {
  const tables = new Map();
  const createTable = /CREATE TABLE (?:IF NOT EXISTS )?"(\w+)" \(([\s\S]*?)\n\);/g;

  for (const [, table, body] of schemaSql.matchAll(createTable)) {
    const columns = body
      .split("\n")
      .map((line) => line.trim().replace(/,$/, ""))
      .filter((line) => line.startsWith('"'))
      .map((definition) => ({
        name: definition.slice(1, definition.indexOf('"', 1)),
        definition,
      }));
    tables.set(table, columns);
  }
  return tables;
}

// Can SQLite ADD this column to a table that already has rows? ALTER TABLE ADD
// COLUMN is limited: no PRIMARY KEY or UNIQUE, and NOT NULL needs a constant
// default (CURRENT_TIMESTAMP and friends are evaluated per row, so they're out).
// Anything that fails these has to be done as a table rebuild by hand.
function addColumnBlocker(definition) {
  const upper = definition.toUpperCase();
  if (upper.includes("PRIMARY KEY")) return "column is a PRIMARY KEY";
  if (upper.includes("UNIQUE")) return "column is UNIQUE";
  if (/DEFAULT\s+CURRENT_(TIMESTAMP|TIME|DATE)/.test(upper)) {
    return "default is not a constant";
  }
  if (upper.includes("NOT NULL") && !upper.includes("DEFAULT")) {
    return "NOT NULL without a default";
  }
  return null;
}

try {
  await client.executeMultiple(idempotentSql);

  // Bring existing tables up to date. Purely ADDITIVE: this never drops,
  // renames or retypes a column, so it can't lose data — the worst case is a
  // column it refuses to add and reports instead.
  const added = [];
  const manual = [];
  for (const [table, columns] of expectedColumns(sql)) {
    const { rows } = await client.execute(`PRAGMA table_info("${table}")`);
    const actual = new Set(rows.map((r) => r.name));

    for (const { name, definition } of columns) {
      if (actual.has(name)) continue;

      const blocker = addColumnBlocker(definition);
      const statement = `ALTER TABLE "${table}" ADD COLUMN ${definition}`;
      if (blocker) {
        manual.push(`-- ${table}.${name}: ${blocker}\n${statement};`);
        continue;
      }
      await client.execute(statement);
      added.push(`${table}.${name}`);
    }
  }

  console.log(`Schema applied to ${url}`);

  if (added.length > 0) {
    console.log(`Added missing column(s): ${added.join(", ")}`);
  }

  if (manual.length > 0) {
    console.error(
      `\n${manual.length} column(s) can't be added by ALTER TABLE and need a\n` +
        "table rebuild by hand (copy rows into a new table with the shape in\n" +
        "prisma/turso-schema.sql, then swap the names):\n\n" +
        manual.join("\n\n"),
    );
    process.exit(1);
  }

  console.log(`Tables: ${[...expectedColumns(sql).keys()].sort().join(", ")}`);
} catch (error) {
  console.error(`Failed to apply schema: ${error.message}`);
  process.exit(1);
} finally {
  client.close();
}
