import { PrismaLibSQL } from "@prisma/adapter-libsql";
import { PrismaClient } from "@prisma/client";

// libSQL driver adapter. In production, point at Turso via TURSO_DATABASE_URL
// (libsql://…) + TURSO_AUTH_TOKEN. In dev, when those aren't set, fall back to
// the local SQLite file used by `prisma migrate` (relative to the project root).
// The local file doesn't exist in a serverless bundle, so falling back there in
// production means the env vars are missing — fail with a message that says so
// instead of a generic "failed to connect to prisma/dev.db" on every request.
if (process.env.NODE_ENV === "production" && !process.env.TURSO_DATABASE_URL) {
  throw new Error(
    "TURSO_DATABASE_URL is not set. Set it (and TURSO_AUTH_TOKEN) in the host's " +
      "environment variables, then redeploy.",
  );
}

const adapter = new PrismaLibSQL({
  url: process.env.TURSO_DATABASE_URL ?? "file:prisma/dev.db",
  authToken: process.env.TURSO_AUTH_TOKEN,
});

// Reuse a single PrismaClient across hot reloads in dev.
const globalForPrisma = globalThis as unknown as {
  prisma?: PrismaClient;
};

export const prisma = globalForPrisma.prisma ?? new PrismaClient({ adapter });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
