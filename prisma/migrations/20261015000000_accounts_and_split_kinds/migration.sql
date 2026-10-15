-- CreateEnum
CREATE TYPE "TripKind" AS ENUM ('TRIP', 'GROUP', 'FRIEND');

-- AlterTable
ALTER TABLE "Trip" ADD COLUMN     "inviteCode" TEXT,
ADD COLUMN     "kind" "TripKind" NOT NULL DEFAULT 'TRIP';

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "passwordHash" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "Trip_inviteCode_key" ON "Trip"("inviteCode");

-- CreateIndex
CREATE INDEX "TripMember_userId_idx" ON "TripMember"("userId");

