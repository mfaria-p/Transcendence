/*
  Warnings:

  - You are about to drop the `OAuthAccount` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropIndex
DROP INDEX "OAuthAccount_provider_providerAccountId_key";

-- DropTable
PRAGMA foreign_keys=off;
DROP TABLE "OAuthAccount";
PRAGMA foreign_keys=on;

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_RefreshToken" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tokenHash" TEXT NOT NULL,
    "expiresAt" DATETIME NOT NULL,
    "revokedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "accountId" TEXT NOT NULL,
    CONSTRAINT "RefreshToken_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "Account" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_RefreshToken" ("accountId", "createdAt", "expiresAt", "id", "revokedAt", "tokenHash") SELECT "accountId", "createdAt", "expiresAt", "id", "revokedAt", "tokenHash" FROM "RefreshToken";
DROP TABLE "RefreshToken";
ALTER TABLE "new_RefreshToken" RENAME TO "RefreshToken";
CREATE UNIQUE INDEX "RefreshToken_tokenHash_key" ON "RefreshToken"("tokenHash");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
