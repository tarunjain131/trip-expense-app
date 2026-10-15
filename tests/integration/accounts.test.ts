import { afterAll, beforeAll, describe, expect, it } from "vitest";

process.env.DATABASE_URL =
  process.env.TEST_DATABASE_URL ?? "postgresql://postgres@localhost:5432/split_expense_test?schema=public";

let users: typeof import("@/lib/services/users");
let trips: typeof import("@/lib/services/trips");
let expenses: typeof import("@/lib/services/expenses");
let access: typeof import("@/lib/access");
let queries: typeof import("@/lib/db/queries");
let prisma: typeof import("@/lib/db/prisma").prisma;

beforeAll(async () => {
  users = await import("@/lib/services/users");
  trips = await import("@/lib/services/trips");
  expenses = await import("@/lib/services/expenses");
  access = await import("@/lib/access");
  queries = await import("@/lib/db/queries");
  prisma = (await import("@/lib/db/prisma")).prisma;
});
afterAll(async () => {
  await prisma.$disconnect();
});

const tag = Math.random().toString(36).slice(2, 8);
async function newUser(name: string) {
  const email = `${name.toLowerCase()}.${tag}.${Math.random().toString(36).slice(2, 6)}@example.com`;
  const { id } = await users.signUp({ name, email, password: "password123" });
  return { id, name, email };
}
const actor = (u: { id: string; name: string }) => ({ id: u.id, name: u.name });
const asUser = (u: { id: string; name: string; email: string }) => ({ id: u.id, name: u.name, email: u.email });
const inviteOf = async (tripId: string) => (await prisma.trip.findUniqueOrThrow({ where: { id: tripId } })).inviteCode!;

describe("accounts", () => {
  it("signs up, authenticates, and rejects bad credentials and duplicate emails", async () => {
    const u = await newUser("Asha");
    expect(await users.authenticate({ email: u.email, password: "password123" })).toBe(u.id);
    expect(await users.authenticate({ email: u.email.toUpperCase(), password: "password123" })).toBe(u.id);
    expect(await users.authenticate({ email: u.email, password: "wrong-password" })).toBeNull();
    expect(await users.authenticate({ email: "nobody@example.com", password: "password123" })).toBeNull();
    await expect(users.signUp({ name: "Dup", email: u.email, password: "password123" })).rejects.toThrow(/already exists/);
    await expect(users.signUp({ name: "Short", email: `s.${tag}@example.com`, password: "short" })).rejects.toThrow();
  });
});

describe("legacy trips (created before accounts existed)", () => {
  it("are adopted only by the account matching LEGACY_OWNER_EMAIL, on signup or login", async () => {
    const legacy = await trips.createTrip({ name: "Old trip", currency: "INR" }); // no owner
    const ownerEmail = `legacy.${tag}@example.com`;
    process.env.LEGACY_OWNER_EMAIL = ownerEmail;
    try {
      const stranger = await newUser("Stranger");
      expect((await prisma.trip.findUniqueOrThrow({ where: { id: legacy.id } })).ownerId).toBeNull();
      expect(await access.accessFor(asUser(stranger), legacy.id)).toBeNull();

      const { id } = await users.signUp({ name: "Real Owner", email: ownerEmail, password: "password123" });
      expect((await prisma.trip.findUniqueOrThrow({ where: { id: legacy.id } })).ownerId).toBe(id);

      // Login also adopts, so the order of signup and configuration doesn't matter.
      const later = await trips.createTrip({ name: "Old trip 2", currency: "INR" });
      await users.authenticate({ email: ownerEmail, password: "password123" });
      expect((await prisma.trip.findUniqueOrThrow({ where: { id: later.id } })).ownerId).toBe(id);
    } finally {
      delete process.env.LEGACY_OWNER_EMAIL;
    }
  });
});

describe("access control", () => {
  it("only the owner can remove a member who has an account", async () => {
    const [owner, b, c] = [await newUser("Boss"), await newUser("Linked"), await newUser("Other")];
    const trip = await trips.createTrip({ name: "Perms", currency: "INR" }, actor(owner));
    await trips.joinTrip(await inviteOf(trip.id), actor(b), null);
    await trips.joinTrip(await inviteOf(trip.id), actor(c), null);
    const linked = await prisma.tripMember.findFirstOrThrow({ where: { tripId: trip.id, userId: b.id } });
    await expect(trips.removeMember(trip.id, linked.id, { id: c.id, isOwner: false })).rejects.toThrow(/only the person who created/);
    await trips.removeMember(trip.id, linked.id, { id: owner.id, isOwner: true });
    expect(await access.accessFor(asUser(b), trip.id)).toBeNull();
  });

  it("only lets the owner and linked members open a trip", async () => {
    const [a, b, c] = [await newUser("Ann"), await newUser("Bob"), await newUser("Cy")];
    const trip = await trips.createTrip({ name: "Private", currency: "INR" }, actor(a));
    expect(await access.accessFor(asUser(a), trip.id)).toMatchObject({ isOwner: true });
    expect(await access.accessFor(asUser(b), trip.id)).toBeNull();

    await trips.joinTrip(await inviteOf(trip.id), actor(b), null);
    expect(await access.accessFor(asUser(b), trip.id)).toMatchObject({ isOwner: false });
    expect(await access.accessFor(asUser(c), trip.id)).toBeNull();
    expect(await access.accessFor(asUser(c), "not-a-uuid")).toBeNull();
  });

  it("lets a joiner claim a placeholder member exactly once", async () => {
    const [a, b, c] = [await newUser("Own"), await newUser("Rahul"), await newUser("Thief")];
    const trip = await trips.createTrip({ name: "Claim", currency: "INR" }, actor(a));
    await trips.addMember(trip.id, { name: "Rahul P" });
    const placeholder = await prisma.tripMember.findFirstOrThrow({ where: { tripId: trip.id, name: "Rahul P" } });
    await trips.joinTrip(await inviteOf(trip.id), actor(b), placeholder.id);
    expect((await prisma.tripMember.findUniqueOrThrow({ where: { id: placeholder.id } })).userId).toBe(b.id);
    await expect(trips.joinTrip(await inviteOf(trip.id), actor(c), placeholder.id)).rejects.toThrow(/already claimed/);
  });

  it("adds a duplicate-named joiner with a suffix", async () => {
    const [a, b] = [await newUser("Sam"), await newUser("Sam")];
    const trip = await trips.createTrip({ name: "Names", currency: "INR" }, actor(a));
    await trips.joinTrip(await inviteOf(trip.id), actor(b), null);
    const names = (await prisma.tripMember.findMany({ where: { tripId: trip.id } })).map((m) => m.name).sort();
    expect(names).toEqual(["Sam", "Sam (2)"]);
  });

  it("deletes a trip with its expenses", async () => {
    const a = await newUser("Del");
    const trip = await trips.createTrip({ name: "Gone", currency: "INR" }, actor(a));
    const me = (await prisma.tripMember.findFirstOrThrow({ where: { tripId: trip.id } })).id;
    await expenses.createExpense(trip.id, {
      title: "Lunch",
      amount: "100",
      splitType: "EQUAL",
      payers: [{ memberId: me }],
      participants: [{ memberId: me }],
    });
    await trips.deleteTrip(trip.id);
    expect(await prisma.trip.findUnique({ where: { id: trip.id } })).toBeNull();
    expect(await prisma.expense.count({ where: { tripId: trip.id } })).toBe(0);
  });
});

describe("friend ledgers (two-person to-and-from balance)", () => {
  it("links an existing account, shows each side the other's name, and reuses the ledger", async () => {
    const [a, b] = [await newUser("Tarun"), await newUser("Rahul")];
    const first = await trips.createFriendLedger({ name: "Rahul", email: b.email }, actor(a));
    expect(first.existing).toBe(false);
    expect(await access.accessFor(asUser(b), first.id)).toMatchObject({ isOwner: false });

    const again = await trips.createFriendLedger({ name: "Rahul", email: b.email }, actor(a));
    expect(again).toEqual({ id: first.id, existing: true });

    const members = await prisma.tripMember.findMany({ where: { tripId: first.id } });
    const mine = members.find((m) => m.userId === a.id)!;
    const theirs = members.find((m) => m.userId === b.id)!;
    expect(queries.displayTripName({ name: "Rahul", kind: "FRIEND", members }, mine.id)).toBe("Rahul");
    expect(queries.displayTripName({ name: "Rahul", kind: "FRIEND", members }, theirs.id)).toBe("Tarun");

    // Tarun pays 1000 split equally: Rahul owes 500.
    await expenses.createExpense(first.id, {
      title: "Dinner",
      amount: "1000",
      splitType: "EQUAL",
      payers: [{ memberId: mine.id }],
      participants: [{ memberId: mine.id }, { memberId: theirs.id }],
    });
    const ledger = (await queries.loadTripLedger(first.id))!;
    expect(ledger.balances.find((x) => x.memberId === mine.id)!.net).toBe(50000);
    expect(ledger.balances.find((x) => x.memberId === theirs.id)!.net).toBe(-50000);
    expect(ledger.suggestions).toHaveLength(1);
  });

  it("supports friends without an account via the invite link, and refuses a third person", async () => {
    const [a, b, c] = [await newUser("Host"), await newUser("Guest"), await newUser("Extra")];
    const { id } = await trips.createFriendLedger({ name: "Guesty" }, actor(a));
    await trips.joinTrip(await inviteOf(id), actor(b), null);
    expect(await access.accessFor(asUser(b), id)).not.toBeNull();
    await expect(trips.joinTrip(await inviteOf(id), actor(c), null)).rejects.toThrow(/both people/);
  });

  it("rejects your own email and a same-name friend", async () => {
    const a = await newUser("Solo");
    await expect(trips.createFriendLedger({ name: "X", email: a.email }, actor(a))).rejects.toThrow(/own email/);
    await expect(trips.createFriendLedger({ name: "solo" }, actor(a))).rejects.toThrow(/different/);
  });
});
