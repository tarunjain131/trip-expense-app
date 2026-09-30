import "dotenv/config";
import { prisma } from "../src/lib/db/prisma";
import { addMember, createTrip } from "../src/lib/services/trips";
import { createExpense } from "../src/lib/services/expenses";
import { createSettlement } from "../src/lib/services/settlements";
import { getTripLedger } from "../src/lib/db/queries";
import { formatMoney } from "../src/lib/money";

const TRIP_NAME = "Chopta Trip — October 2026";
const NAMES = ["Tarun", "Rahul", "Amit", "Rohit", "Kunal", "Ankit", "Vivek", "Harsh", "Mohit", "Nikhil", "Akash", "Varun"];

async function main() {
  // Idempotent: replace any previous demo trip (cascades to members/expenses/settlements).
  await prisma.trip.deleteMany({ where: { name: TRIP_NAME } });

  const trip = await createTrip({ name: TRIP_NAME, description: "Group trip - 12 friends, 4 days", currency: "INR" });
  const id: Record<string, string> = {};
  for (const n of NAMES) id[n] = (await addMember(trip.id, { name: n })).id;
  const everyone = NAMES.map((n) => ({ memberId: id[n] }));
  const some = (...names: string[]) => names.map((n) => ({ memberId: id[n] }));

  const expenses = [
    { title: "Hotel - 3 nights", amount: "48000", category: "HOTEL", spentAt: "2026-10-03", payers: [{ memberId: id.Tarun }], splitType: "EQUAL", participants: everyone },
    { title: "Breakfast", amount: "3600", category: "FOOD", spentAt: "2026-10-04", payers: [{ memberId: id.Amit }], splitType: "EQUAL", participants: everyone },
    {
      title: "Dinner at the dhaba",
      amount: "9600",
      category: "FOOD",
      spentAt: "2026-10-04",
      payers: [{ memberId: id.Rahul }],
      splitType: "EQUAL",
      participants: some("Tarun", "Rahul", "Amit", "Rohit", "Kunal", "Ankit", "Vivek", "Harsh"),
    },
    {
      title: "Fuel",
      amount: "6200",
      category: "FUEL",
      spentAt: "2026-10-03",
      payers: [{ memberId: id.Rohit }],
      splitType: "EQUAL",
      participants: some("Tarun", "Rohit", "Kunal", "Ankit", "Vivek"),
    },
    {
      title: "Toll",
      amount: "850",
      category: "TRANSPORT",
      spentAt: "2026-10-03",
      payers: [{ memberId: id.Kunal }],
      splitType: "EQUAL",
      participants: some("Tarun", "Rohit", "Kunal", "Ankit", "Vivek"),
    },
    {
      title: "Cab to Tungnath",
      amount: "4500.50",
      category: "TRANSPORT",
      spentAt: "2026-10-05",
      payers: [
        { memberId: id.Harsh, amount: "3000" },
        { memberId: id.Mohit, amount: "1500.50" },
      ],
      splitType: "SHARES",
      participants: [
        { memberId: id.Harsh, value: "2" },
        { memberId: id.Mohit, value: "1" },
        { memberId: id.Nikhil, value: "1" },
        { memberId: id.Akash, value: "1" },
        { memberId: id.Varun, value: "1" },
      ],
    },
    {
      title: "Tickets - Deoria Tal camping",
      amount: "7200",
      category: "TICKETS",
      spentAt: "2026-10-05",
      payers: [{ memberId: id.Ankit }],
      splitType: "PERCENTAGE",
      participants: [
        { memberId: id.Tarun, value: "20" },
        { memberId: id.Rahul, value: "20" },
        { memberId: id.Amit, value: "20" },
        { memberId: id.Ankit, value: "20" },
        { memberId: id.Vivek, value: "10" },
        { memberId: id.Harsh, value: "10" },
      ],
    },
    { title: "Snacks", amount: "1347.35", category: "FOOD", spentAt: "2026-10-05", payers: [{ memberId: id.Vivek }], splitType: "EQUAL", participants: everyone },
    {
      title: "Trek guide",
      amount: "5000",
      category: "ACTIVITIES",
      spentAt: "2026-10-05",
      payers: [{ memberId: id.Nikhil }],
      splitType: "EXACT",
      participants: [
        { memberId: id.Nikhil, value: "2000" },
        { memberId: id.Akash, value: "1500" },
        { memberId: id.Varun, value: "1000" },
        { memberId: id.Mohit, value: "500" },
      ],
    },
    {
      title: "Souvenirs",
      amount: "2400",
      category: "SHOPPING",
      spentAt: "2026-10-06",
      payers: [{ memberId: id.Varun }],
      splitType: "EQUAL",
      participants: some("Varun", "Akash", "Nikhil"),
    },
  ];
  for (const e of expenses) await createExpense(trip.id, e);

  // Record one settlement using the engine's own first suggestion (nothing hard-coded).
  const before = (await getTripLedger(trip.id))!;
  const first = before.suggestions[0];
  if (first) {
    await createSettlement(trip.id, { payerId: first.fromId, receiverId: first.toId, amount: (first.amountMinor / 100).toFixed(2) });
  }

  const ledger = (await getTripLedger(trip.id))!;
  console.log(`\nSeeded "${TRIP_NAME}"  (${trip.id})`);
  console.log(`Total spent: ${formatMoney(ledger.summary.totalSpent)} across ${ledger.expenses.length} expenses`);
  console.log(`Suggested settlements remaining: ${ledger.suggestions.length}`);
  for (const s of ledger.suggestions) {
    console.log(`  ${ledger.memberById.get(s.fromId)?.name} -> ${ledger.memberById.get(s.toId)?.name}: ${formatMoney(s.amountMinor)}`);
  }
  console.log(`\nOpen: /trips/${trip.id}`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
