-- Integrity constraints Prisma cannot express.
ALTER TABLE "Expense" ADD CONSTRAINT "Expense_amount_positive" CHECK ("amount" > 0);
ALTER TABLE "ExpensePayer" ADD CONSTRAINT "ExpensePayer_amount_positive" CHECK ("amount" > 0);
ALTER TABLE "ExpenseSplit" ADD CONSTRAINT "ExpenseSplit_amount_nonneg" CHECK ("amount" >= 0);
ALTER TABLE "Settlement" ADD CONSTRAINT "Settlement_amount_positive" CHECK ("amount" > 0);
ALTER TABLE "Settlement" ADD CONSTRAINT "Settlement_distinct_parties" CHECK ("payerId" <> "receiverId");
