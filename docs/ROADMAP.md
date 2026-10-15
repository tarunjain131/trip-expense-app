# Splitrip roadmap

Play Store packaging and Google sign-in are out of scope for now.

## Core idea: one ledger engine, three kinds of split

Everything (expenses, splits, balances, settle-up) already lives on `Trip`. Rather than build a second system for
two-person balances, `Trip` gets a `kind`:

| Kind     | What it is                                                | Who is in it                          |
| -------- | --------------------------------------------------------- | ------------------------------------- |
| `TRIP`   | A trip with a group                                       | Many people                           |
| `GROUP`  | Ongoing group (flatmates, office lunch)                   | Many people                           |
| `FRIEND` | Running "to and from" balance between exactly two people  | You + one friend (always 2 members)   |

The money engine, summary and settle-up are reused unchanged. A friend ledger shows the *other person's* name to each side.

## Phase 1 — Accounts, access, friends (done)

- Email + password accounts (scrypt hashes, signed HttpOnly session cookie). Replaces the shared `APP_PASSWORD` gate.
- `Trip.kind`, `Trip.inviteCode`; trips are only visible to the owner and linked members.
- Join by invite link (`/join/<code>`): claim an existing placeholder member or join as new.
- Friends: add by name (+ optional email). If the email is a registered user, both sides see the ledger immediately;
  otherwise share the invite link.
- Home dashboard: overall "you owe / you are owed", friends section, groups & trips section.
- "You" is derived from the logged-in account, not a cookie.
- Owner-only: delete / rename trip. Everyone in a split can add and edit expenses and settlements.

**Removed:** shared password gate (`APP_PASSWORD`), the "You" cookie and `YouPicker`, unused Next.js starter SVGs.

## Phase 2 — Insights
- Pie / donut: share per member, spend per category. Bar: spend per day. Paid vs owed per member.
- Per-friend history page and CSV export.

## Phase 3 — Product polish
- Account page (change password, delete account), password reset by email.
- Activity log, search, receipts, UPI "pay" links, reminders, multi-currency.
- Offline-tolerant PWA.

## Phase 4 — Later
- Play Store packaging.
