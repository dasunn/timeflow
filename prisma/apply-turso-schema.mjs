// Applies prisma/turso-schema.sql to the Turso database named by
// TURSO_DATABASE_URL / TURSO_AUTH_TOKEN in .env. Run with `npm run db:turso`.
//
// This exists so the schema can be created without installing the Turso CLI,
// which on Windows requires WSL. It only creates tables that don't exist yet, so
// running it twice on an already-populated database is a no-op, not a wipe.
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

// Expected columns per table, parsed out of the SQL above. CREATE TABLE IF NOT
// EXISTS leaves an already-existing table alone, so a table created from an
// older version of this file keeps its old shape and the app fails at query
// time with "no such column". Compare and report rather than fail silently.
function expectedColumns(schemaSql) {
  const tables = new Map();
  const createTable = /CREATE TABLE (?:IF NOT EXISTS )?"(\w+)" \(([\s\S]*?)\n\);/g;

  for (const [, table, body] of schemaSql.matchAll(createTable)) {
    const columns = body
      .split("\n")
      .map((line) => line.trim())
      .filter((line) => line.startsWith('"'))
      .map((line) => line.slice(1, line.indexOf('"', 1)));
    tables.set(table, columns);
  }
  return tables;
}

try {
  await client.executeMultiple(idempotentSql);

  const drift = [];
  for (const [table, columns] of expectedColumns(sql)) {
    const { rows } = await client.execute(`PRAGMA table_info("${table}")`);
    const actual = new Set(rows.map((r) => r.name));
    for (const column of columns.filter((c) => !actual.has(c))) {
      drift.push(`ALTER TABLE "${table}" ADD COLUMN "${column}" <TYPE>;`);
    }
  }

  console.log(`Schema applied to ${url}`);

  if (drift.length > 0) {
    console.error(
      `\n${drift.length} column(s) missing from existing tables. CREATE TABLE\n` +
        "cannot add them — run these against the database, filling in each type\n" +
        "from prisma/turso-schema.sql:\n\n" +
        drift.join("\n"),
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
