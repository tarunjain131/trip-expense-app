import { expect, test, type Page } from "@playwright/test";
import { E2E_PASSWORD } from "../../playwright.config";

const NAMES = ["Tarun", "Rahul", "Amit", "Rohit", "Kunal", "Ankit", "Vivek", "Harsh", "Mohit", "Nikhil", "Akash", "Varun"];

async function login(page: Page) {
  await page.goto("/login");
  await page.getByLabel("Password").fill(E2E_PASSWORD);
  await page.getByRole("button", { name: "Log in" }).click();
  await expect(page).toHaveURL(/\/trips$/);
}

test.describe("access control", () => {
  test("the app is locked until the password is entered", async ({ page, request }) => {
    // Unauthenticated pages redirect to the login page, preserving where you were going.
    await page.goto("/trips/00000000-0000-4000-8000-000000000000/members");
    await expect(page).toHaveURL(/\/login\?next=/);
    // Server Actions / POSTs without a session are rejected outright.
    const post = await request.post("/trips", { data: {}, maxRedirects: 0 });
    expect(post.status()).toBe(401);

    await page.getByLabel("Password").fill("wrong-password");
    await page.getByRole("button", { name: "Log in" }).click();
    await expect(page.locator("#login-error")).toContainText("isn't right");

    await page.getByLabel("Password").fill(E2E_PASSWORD);
    await page.getByRole("button", { name: "Log in" }).click();
    // lands back on the page that was requested (404 trip is fine - we are past the gate)
    await expect(page).toHaveURL(/\/trips\/0000/);

    await page.goto("/trips");
    await page.getByRole("button", { name: /log out/i }).click();
    await expect(page).toHaveURL(/\/login/);
    await page.goto("/trips");
    await expect(page).toHaveURL(/\/login/);
  });
});

async function addExpense(
  page: Page,
  tripUrl: string,
  e: { amount: string; title: string; paidBy: string; only?: string[] },
) {
  await page.goto(`${tripUrl}/expenses/new`);
  await page.getByLabel("Amount", { exact: true }).fill(e.amount);
  await page.getByLabel("What was it for?").fill(e.title);
  await page.getByLabel("Paid by").selectOption({ label: e.paidBy });
  if (e.only) {
    await page.getByRole("button", { name: "Clear" }).click();
    for (const n of e.only) await page.getByRole("checkbox", { name: n, exact: true }).check();
    await expect(page.getByText(`${e.only.length} of 12 people`)).toBeVisible();
  }
  await page.getByRole("button", { name: /^Add ₹/ }).click();
  await expect(page).toHaveURL(/\/expenses$/);
  await expect(page.getByRole("link", { name: new RegExp(e.title) }).first()).toBeVisible();
}

test("trip → members → expenses → balances → settle up", async ({ page }) => {
  await login(page);
  // 1. create a trip
  await page.goto("/trips");
  await page.getByRole("button", { name: /new trip|create your first trip/i }).first().click();
  await page.getByLabel("Trip name").fill(`E2E Chopta ${Date.now()}`);
  await page.getByRole("button", { name: "Create trip" }).click();
  await expect(page).toHaveURL(/\/trips\/[0-9a-f-]{36}\/members$/);
  const tripUrl = new URL(page.url()).pathname.replace(/\/members$/, "");

  // 2. add 12 members in one go
  await page.getByLabel("Add members").fill(NAMES.join(", "));
  await page.getByRole("button", { name: "Add", exact: true }).click();
  await expect(page.getByText("12 people")).toBeVisible();

  // Duplicate and rename checks
  await page.getByLabel("Add members").fill("tarun");
  await page.getByRole("button", { name: "Add", exact: true }).click();
  await expect(page.getByRole("alert").filter({ hasText: "already in this trip" })).toBeVisible();

  // 3-4. hotel split among everyone (Tarun pays; default payer is the first member)
  await addExpense(page, tripUrl, { amount: "12000", title: "Hotel", paidBy: "Tarun" });
  // 5. dinner for 8 (first eight), Rahul paid
  await addExpense(page, tripUrl, { amount: "2400", title: "Dinner", paidBy: "Rahul", only: NAMES.slice(0, 8) });
  // 6. fuel for 5, Amit paid
  await addExpense(page, tripUrl, { amount: "1000", title: "Fuel", paidBy: "Amit", only: NAMES.slice(0, 5) });

  // 7-8. balances
  await page.goto(`${tripUrl}/balances`);
  const net = (name: string) => page.getByTestId(`balance-${name}`).getByTestId("net");
  await expect(net("Tarun")).toHaveText("+₹10,500");
  await expect(net("Rahul")).toHaveText("+₹900");
  await expect(net("Amit")).toHaveText("-₹500");
  await expect(net("Rohit")).toHaveText("-₹1,500");
  await expect(net("Ankit")).toHaveText("-₹1,300");
  await expect(net("Varun")).toHaveText("-₹1,000");
  await expect(page.getByTestId("balance-Tarun")).toContainText("gets back ₹10,500");
  await expect(page.getByTestId("balance-Varun")).toContainText("owes ₹1,000");

  // "You" is display-only
  await page.goto(tripUrl);
  await page.getByLabel(/Who are you/).selectOption({ label: "Tarun" });
  await expect(page.getByText("You get back ₹10,500")).toBeVisible();
  await expect(page.getByTestId("total-expenses")).toHaveText("₹15,400");

  // 9-11. settle up: mark the first suggestion paid and verify the outstanding balance drops by that amount
  await page.goto(`${tripUrl}/summary`);
  await expect(page.getByTestId("outstanding-amount")).toHaveText("₹11,400");
  await expect(page.getByTestId("settled-amount")).toHaveText("₹0");

  await page.goto(`${tripUrl}/settlements`);
  const suggestions = page.getByTestId("suggestion");
  const first = suggestions.first();
  const before = await suggestions.count();
  expect(before).toBeGreaterThan(0);
  expect(before).toBeLessThanOrEqual(11);
  const amountText = (await first.locator("p.text-lg").innerText()).trim();
  const amount = Number(amountText.replace(/[₹,]/g, ""));
  await first.getByRole("button", { name: /Mark as paid/ }).click();
  await expect(page.getByText(/paid .* ₹/).first()).toBeVisible();
  await expect(page.getByRole("heading", { name: "Settlement history" })).toBeVisible();
  await expect(page.getByRole("button", { name: /Undo/ }).first()).toBeVisible();

  await page.goto(`${tripUrl}/summary`);
  const expectedOutstanding = 11400 - amount;
  await expect(page.getByTestId("settled-amount")).toHaveText(`₹${amount.toLocaleString("en-IN")}`);
  await expect(page.getByTestId("outstanding-amount")).toHaveText(`₹${expectedOutstanding.toLocaleString("en-IN")}`);

  // Revert restores the outstanding balance
  await page.goto(`${tripUrl}/settlements`);
  await page.getByRole("button", { name: /Undo/ }).first().click();
  await page.getByRole("button", { name: "Undo settlement" }).click();
  await expect(page.getByText("Reverted", { exact: false }).first()).toBeVisible();
  await page.goto(`${tripUrl}/summary`);
  await expect(page.getByTestId("outstanding-amount")).toHaveText("₹11,400");
});

test("edit and delete an expense, validation errors, split types", async ({ page }) => {
  await login(page);
  await page.goto("/trips");
  await page.getByRole("button", { name: /new trip|create your first trip/i }).first().click();
  await page.getByLabel("Trip name").fill(`E2E Edit ${Date.now()}`);
  await page.getByRole("button", { name: "Create trip" }).click();
  await expect(page).toHaveURL(/\/members$/);
  const tripUrl = new URL(page.url()).pathname.replace(/\/members$/, "");
  await page.getByLabel("Add members").fill("Tarun, Rahul, Amit, Rohit");
  await page.getByRole("button", { name: "Add", exact: true }).click();
  await expect(page.getByText("4 people")).toBeVisible();

  // Exact split validation
  await page.goto(`${tripUrl}/expenses/new`);
  await page.getByLabel("Amount", { exact: true }).fill("1200");
  await page.getByLabel("What was it for?").fill("Dinner");
  await page.getByRole("radio", { name: "Exact amounts" }).click();
  await page.getByLabel("Tarun: amount").fill("400");
  await page.getByLabel("Rahul: amount").fill("300");
  await page.getByLabel("Amit: amount").fill("300");
  await page.getByLabel("Rohit: amount").fill("100");
  await expect(page.getByText("₹100 left to assign")).toBeVisible();
  await page.getByRole("button", { name: /^Add ₹/ }).click();
  await expect(page.getByRole("alert").filter({ hasText: "add up" })).toBeVisible();
  await page.getByLabel("Rohit: amount").fill("200");
  await expect(page.getByText("Adds up to the total")).toBeVisible();
  await page.getByRole("button", { name: /^Add ₹/ }).click();
  await expect(page).toHaveURL(/\/expenses$/);

  // Percentage split
  await page.goto(`${tripUrl}/expenses/new`);
  await page.getByLabel("Amount", { exact: true }).fill("1000");
  await page.getByLabel("What was it for?").fill("Tickets");
  await page.getByRole("radio", { name: "Percentages" }).click();
  await page.getByLabel("Tarun: percent").fill("50");
  await page.getByLabel("Rahul: percent").fill("25");
  await page.getByLabel("Amit: percent").fill("25");
  await page.getByLabel("Rohit: percent").fill("0");
  await page.getByRole("button", { name: /^Add ₹/ }).click();
  await expect(page).toHaveURL(/\/expenses$/);

  // Balances: Tarun paid nothing; check Tarun's share = 400 + 500 = 900
  await page.goto(`${tripUrl}/balances`);
  await expect(page.getByTestId("balance-Tarun")).toContainText("₹900");

  // Open the Dinner expense, edit the amount, then delete it
  await page.goto(`${tripUrl}/expenses`);
  await page.getByRole("link", { name: /Dinner/ }).click();
  await expect(page.getByTestId("expense-amount")).toHaveText("₹1,200");
  await page.getByRole("link", { name: "Edit" }).click();
  await page.getByLabel("Amount", { exact: true }).fill("2400");
  // exact split no longer adds up: the server must reject it
  await page.getByRole("button", { name: "Save changes" }).click();
  await expect(page.getByRole("alert").filter({ hasText: "add up" })).toBeVisible();
  await page.getByRole("radio", { name: "Equally" }).click();
  await page.getByRole("button", { name: "Save changes" }).click();
  await expect(page.getByTestId("expense-amount")).toHaveText("₹2,400");

  await page.getByRole("button", { name: "Delete" }).click();
  await page.getByRole("button", { name: "Delete expense" }).click();
  await expect(page).toHaveURL(/\/expenses$/);
  await expect(page.getByRole("link", { name: /Dinner/ })).toHaveCount(0);
  await expect(page.getByRole("link", { name: /Tickets/ })).toBeVisible();

  // Member with history can't be removed
  await page.goto(`${tripUrl}/members`);
  await page.getByRole("button", { name: "Remove Tarun" }).click();
  await page.getByRole("button", { name: "Remove", exact: true }).click();
  await expect(page.getByText(/part of existing expenses/).first()).toBeVisible();
});
