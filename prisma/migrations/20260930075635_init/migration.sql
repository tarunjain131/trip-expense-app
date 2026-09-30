-- CreateEnum
CREATE TYPE "SplitType" AS ENUM ('EQUAL', 'EXACT', 'PERCENTAGE', 'SHARES');

-- CreateEnum
CREATE TYPE "ExpenseCategory" AS ENUM ('FOOD', 'HOTEL', 'TRANSPORT', 'FUEL', 'TICKETS', 'ACTIVITIES', 'SHOPPING', 'MISC');

-- CreateEnum
CREATE TYPE "SettlementStatus" AS ENUM ('COMPLETED', 'REVERTED');

-- CreateTable
CREATE TABLE "User" (
    "id" UUID NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Trip" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "currency" TEXT NOT NULL DEFAULT 'INR',
    "ownerId" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Trip_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TripMember" (
    "id" UUID NOT NULL,
    "tripId" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "userId" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TripMember_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Expense" (
    "id" UUID NOT NULL,
    "tripId" UUID NOT NULL,
    "title" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'INR',
    "category" "ExpenseCategory",
    "notes" TEXT,
    "splitType" "SplitType" NOT NULL DEFAULT 'EQUAL',
    "spentAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Expense_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ExpensePayer" (
    "id" UUID NOT NULL,
    "expenseId" UUID NOT NULL,
    "memberId" UUID NOT NULL,
    "amount" INTEGER NOT NULL,

    CONSTRAINT "ExpensePayer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ExpenseSplit" (
    "id" UUID NOT NULL,
    "expenseId" UUID NOT NULL,
    "memberId" UUID NOT NULL,
    "amount" INTEGER NOT NULL,
    "value" INTEGER,

    CONSTRAINT "ExpenseSplit_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Settlement" (
    "id" UUID NOT NULL,
    "tripId" UUID NOT NULL,
    "payerId" UUID NOT NULL,
    "receiverId" UUID NOT NULL,
    "amount" INTEGER NOT NULL,
    "status" "SettlementStatus" NOT NULL DEFAULT 'COMPLETED',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "paidAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "revertedAt" TIMESTAMP(3),

    CONSTRAINT "Settlement_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE INDEX "Trip_ownerId_idx" ON "Trip"("ownerId");

-- CreateIndex
CREATE INDEX "Trip_createdAt_idx" ON "Trip"("createdAt");

-- CreateIndex
CREATE INDEX "TripMember_tripId_idx" ON "TripMember"("tripId");

-- CreateIndex
CREATE INDEX "Expense_tripId_spentAt_idx" ON "Expense"("tripId", "spentAt");

-- CreateIndex
CREATE INDEX "Expense_tripId_category_idx" ON "Expense"("tripId", "category");

-- CreateIndex
CREATE INDEX "ExpensePayer_memberId_idx" ON "ExpensePayer"("memberId");

-- CreateIndex
CREATE UNIQUE INDEX "ExpensePayer_expenseId_memberId_key" ON "ExpensePayer"("expenseId", "memberId");

-- CreateIndex
CREATE INDEX "ExpenseSplit_memberId_idx" ON "ExpenseSplit"("memberId");

-- CreateIndex
CREATE UNIQUE INDEX "ExpenseSplit_expenseId_memberId_key" ON "ExpenseSplit"("expenseId", "memberId");

-- CreateIndex
CREATE INDEX "Settlement_tripId_status_idx" ON "Settlement"("tripId", "status");

-- CreateIndex
CREATE INDEX "Settlement_payerId_idx" ON "Settlement"("payerId");

-- CreateIndex
CREATE INDEX "Settlement_receiverId_idx" ON "Settlement"("receiverId");

-- AddForeignKey
ALTER TABLE "Trip" ADD CONSTRAINT "Trip_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TripMember" ADD CONSTRAINT "TripMember_tripId_fkey" FOREIGN KEY ("tripId") REFERENCES "Trip"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TripMember" ADD CONSTRAINT "TripMember_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Expense" ADD CONSTRAINT "Expense_tripId_fkey" FOREIGN KEY ("tripId") REFERENCES "Trip"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExpensePayer" ADD CONSTRAINT "ExpensePayer_expenseId_fkey" FOREIGN KEY ("expenseId") REFERENCES "Expense"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExpensePayer" ADD CONSTRAINT "ExpensePayer_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "TripMember"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExpenseSplit" ADD CONSTRAINT "ExpenseSplit_expenseId_fkey" FOREIGN KEY ("expenseId") REFERENCES "Expense"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExpenseSplit" ADD CONSTRAINT "ExpenseSplit_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "TripMember"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Settlement" ADD CONSTRAINT "Settlement_tripId_fkey" FOREIGN KEY ("tripId") REFERENCES "Trip"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Settlement" ADD CONSTRAINT "Settlement_payerId_fkey" FOREIGN KEY ("payerId") REFERENCES "TripMember"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Settlement" ADD CONSTRAINT "Settlement_receiverId_fkey" FOREIGN KEY ("receiverId") REFERENCES "TripMember"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
