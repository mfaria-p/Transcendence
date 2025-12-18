/*
  Warnings:

  - You are about to drop the column `fromUserId` on the `FriendRequest` table. All the data in the column will be lost.
  - You are about to drop the column `toUserId` on the `FriendRequest` table. All the data in the column will be lost.
  - You are about to drop the column `userAId` on the `Friendship` table. All the data in the column will be lost.
  - You are about to drop the column `userBId` on the `Friendship` table. All the data in the column will be lost.
  - Added the required column `fromProfileId` to the `FriendRequest` table without a default value. This is not possible if the table is not empty.
  - Added the required column `toProfileId` to the `FriendRequest` table without a default value. This is not possible if the table is not empty.
  - Added the required column `profileAId` to the `Friendship` table without a default value. This is not possible if the table is not empty.
  - Added the required column `profileBId` to the `Friendship` table without a default value. This is not possible if the table is not empty.

*/
-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_FriendRequest" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "fromProfileId" TEXT NOT NULL,
    "toProfileId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "message" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "FriendRequest_fromProfileId_fkey" FOREIGN KEY ("fromProfileId") REFERENCES "Profile" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "FriendRequest_toProfileId_fkey" FOREIGN KEY ("toProfileId") REFERENCES "Profile" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_FriendRequest" ("createdAt", "id", "message", "status", "updatedAt") SELECT "createdAt", "id", "message", "status", "updatedAt" FROM "FriendRequest";
DROP TABLE "FriendRequest";
ALTER TABLE "new_FriendRequest" RENAME TO "FriendRequest";
CREATE INDEX "FriendRequest_toProfileId_status_idx" ON "FriendRequest"("toProfileId", "status");
CREATE INDEX "FriendRequest_fromProfileId_status_idx" ON "FriendRequest"("fromProfileId", "status");
CREATE UNIQUE INDEX "FriendRequest_fromProfileId_toProfileId_key" ON "FriendRequest"("fromProfileId", "toProfileId");
CREATE TABLE "new_Friendship" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "profileAId" TEXT NOT NULL,
    "profileBId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Friendship_profileAId_fkey" FOREIGN KEY ("profileAId") REFERENCES "Profile" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Friendship_profileBId_fkey" FOREIGN KEY ("profileBId") REFERENCES "Profile" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_Friendship" ("createdAt", "id") SELECT "createdAt", "id" FROM "Friendship";
DROP TABLE "Friendship";
ALTER TABLE "new_Friendship" RENAME TO "Friendship";
CREATE INDEX "Friendship_createdAt_idx" ON "Friendship"("createdAt");
CREATE UNIQUE INDEX "Friendship_profileAId_profileBId_key" ON "Friendship"("profileAId", "profileBId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
