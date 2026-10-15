# Splitrip — expense splitting for trips, groups and friends

A Splitwise-style app: sign up, then keep a running two-person balance with a friend, or split a trip / ongoing group with many people.
Record expenses (equal / exact / percentage / shares, one or many payers), see who is owed what, and settle up with the fewest payments.
See [docs/ROADMAP.md](docs/ROADMAP.md) for what is done and planned.

**Stack:** Next.js 16 (App Router, Server Components + Server Actions) · TypeScript · Tailwind CSS v4 · shadcn/ui (Radix) ·
Lucide · PostgreSQL · Prisma 7 · Zod · React Hook Form · Vitest · Playwright.

## Setup

Requirements: Node 20.19+ (22 recommended), npm, and a PostgreSQL database (local, Neon, Supabase, Railway, ...).

```bash
npm install                      # also runs `prisma generate`
cp .env.example .env             # then set DATABASE_URL
npm run db:deploy                # apply migrations   (use `npm run db:migrate` while developing schema changes)
npm run db:seed                  # optional: demo "Chopta Trip — October 2026" with 12 members and 10 expenses
npm run dev                      # http://localhost:3000
```

### Environment variables

| Variable | Required | Description |
| --- | --- | --- |
| `DATABASE_URL` | yes | PostgreSQL connection string, e.g. `postgresql://user:pass@host:5432/db?schema=public` |
| `AUTH_SECRET` | production | Signs the login session cookie (`openssl rand -hex 32`). If unset in production the app stays **locked**; changing it logs everyone out |
| `LEGACY_OWNER_EMAIL` | once | Email of the account that adopts trips created before accounts existed |
| `NEXT_PUBLIC_TIME_ZONE` | no | IANA zone used to show settlement timestamps and "today" in forms (default `Asia/Kolkata`) |
| `TEST_DATABASE_URL` | tests | Database for integration tests (default `postgresql://postgres@localhost:5432/split_expense_test`) |
| `E2E_DATABASE_URL` | e2e | Database for Playwright (defaults to the same test database) |

Never commit `.env`; only `.env.example` is tracked.

## Scripts

| Command | What it does |
| --- | --- |
| `npm run dev` | Development server |
| `npm run build` / `npm start` | Production build / server (`build` runs `prisma generate` first) |
| `npm test` | Vitest: pure-domain unit tests **and** service integration tests against `TEST_DATABASE_URL` (migrated automatically) |
| `npm run test:unit` | Only the pure financial-engine tests (no database needed) |
| `npm run test:e2e` | Playwright end-to-end flow against a production build on port 3100 and the test database |
| `npm run typecheck` / `npm run lint` | TypeScript and ESLint |
| `npm run db:migrate` / `db:deploy` / `db:seed` / `db:studio` | Prisma helpers |

Create the test database once (`createdb split_expense_test`). For E2E, run `npx playwright install chromium`, or reuse an installed
browser with `PW_CHANNEL=msedge npm run test:e2e` (or `chrome`).

## Deploying (Vercel or any Node host)

1. Provision Postgres and set `DATABASE_URL` and `AUTH_SECRET` in the host's environment.
2. Run `npm run db:deploy` against that database (CI step or one-off).
3. Deploy. `postinstall` generates the Prisma client; `npm run build` does too.

Nothing is provider-specific: Prisma uses the standard `pg` driver adapter. With a pooled connection string (e.g. Neon/Supabase pooler)
everything works as-is.

## Architecture

```
src/lib/
  money/        integer minor-unit parsing + formatting (no floats in calculations), currency table
  expenses/     calculateExpenseSplits(), validatePayers()        ← pure
  balances/     calculateMemberBalances(), calculateOutstandingBalances() ← pure
  settlements/  calculateSettlements() (debt simplification), validateSettlementAgainstBalances() ← pure
  summary/      calculateTripSummary()                            ← pure
  validation/   Zod schemas (all input is validated on the server)
  services/     transactional mutations (Prisma) — trips/members, expenses, settlements
  db/           Prisma client + read queries that feed the domain layer
src/actions/    thin Server Actions: call services, map errors to user-safe messages
src/app/        routes (Server Components) ·  src/components/  UI
prisma/         schema, migrations, seed
tests/          unit (domain) · integration (services + real DB) · e2e (Playwright)
```

### Money & balances

* All amounts are integers in minor units (₹100.50 = `10050` paise), stored as `INTEGER` with `CHECK` constraints. Typed amounts are
  parsed with string arithmetic (never `parseFloat`). Percentages are basis points (33.33% = `3333`).
* Splits use the **largest-remainder method** with deterministic tie-breaking, so shares always sum exactly to the total (₹100 ÷ 3 =
  33.34 / 33.33 / 33.33).
* Balances are **never stored**. `net = paid − share + settlements paid − settlements received`, derived on every request from expenses and
  `COMPLETED` settlements. Editing/deleting an expense or reverting a settlement therefore updates everything automatically.
* **Settle up** works from net balances only. It finds the largest partition of members into independent zero-sum groups (exact bitmask DP for
  up to 16 non-zero balances, greedy beyond that), then settles each group in at most `k−1` payments.
* Marking a payment as paid creates a `Settlement` row (kept forever). Undo sets `status = REVERTED`. Part payments are supported; a payment
  can never exceed what the payer owes or the receiver is owed — this is re-checked inside the transaction under a per-trip row lock, so double
  clicks and stale screens can't over-settle.

### Accounts, access and splits

* **Accounts:** email + password (scrypt hashes). The session is a signed, HttpOnly, 30-day cookie `userId.expiry.signature`; `src/proxy.ts`
  redirects visitors without a valid one to `/login` (POSTs get a 401) and `getCurrentUser()` confirms the user still exists.
  Production fails closed without `AUTH_SECRET`. Login/signup attempts are throttled per IP (best effort, per server instance).
* **Three kinds of split** share one engine: `TRIP`, `GROUP`, and `FRIEND` (exactly two people: a running to-and-from balance, shown to each
  side under the other person's name).
* **Access:** a trip is visible to its owner and to members linked to an account (`TripMember.userId`). Every query and Server Action
  goes through `getTripAccess` / `requireTripAccess` (`src/lib/access.ts`); anything else is "not found". Only the owner can delete or reset the invite link.
* **Invites:** `/join/<code>` (after logging in) claims an existing placeholder member or adds the person as a new member; a friend ledger
  claims its one free spot. Trips created before accounts existed (no owner) are adopted by the account whose email equals `LEGACY_OWNER_EMAIL` (on signup or login).
* Every mutation is validated with Zod on the server and all ids are checked to belong to the trip in the URL (no cross-trip access).

## Known limitations

* No password reset / email verification yet (see the roadmap).
* Single currency per trip (INR default; INR/USD/EUR/GBP selectable), no conversion.
* Members that appear in any expense or settlement cannot be deleted (only renamed) to keep history intact.
* `npm run db:seed` creates a demo trip with no owner, so it is not visible to any account (it is only useful for inspecting data).
