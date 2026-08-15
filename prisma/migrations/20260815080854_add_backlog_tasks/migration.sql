-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Task" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "categoryId" TEXT,
    "description" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'NEW',
    "plannedStart" DATETIME NOT NULL,
    "plannedEnd" DATETIME NOT NULL,
    "isBacklog" BOOLEAN NOT NULL DEFAULT false,
    "estimatedMinutes" INTEGER,
    "dragDelayCount" INTEGER NOT NULL DEFAULT 0,
    "autoDelayCount" INTEGER NOT NULL DEFAULT 0,
    "notifyMinutesBefore" INTEGER,
    "notifiedAt" DATETIME,
    "isLocked" BOOLEAN NOT NULL DEFAULT false,
    "completedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Task_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "Category" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_Task" ("autoDelayCount", "categoryId", "completedAt", "createdAt", "description", "dragDelayCount", "id", "isLocked", "notifiedAt", "notifyMinutesBefore", "plannedEnd", "plannedStart", "status", "updatedAt") SELECT "autoDelayCount", "categoryId", "completedAt", "createdAt", "description", "dragDelayCount", "id", "isLocked", "notifiedAt", "notifyMinutesBefore", "plannedEnd", "plannedStart", "status", "updatedAt" FROM "Task";
DROP TABLE "Task";
ALTER TABLE "new_Task" RENAME TO "Task";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
