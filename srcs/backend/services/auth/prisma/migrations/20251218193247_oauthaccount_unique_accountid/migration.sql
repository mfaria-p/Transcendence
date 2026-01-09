/*
  Warnings:

  - A unique constraint covering the columns `[accountId]` on the table `OAuthAccount` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateIndex
CREATE UNIQUE INDEX "OAuthAccount_accountId_key" ON "OAuthAccount"("accountId");
