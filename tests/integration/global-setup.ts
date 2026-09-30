import { execSync } from "node:child_process";

/** Point integration tests at a dedicated database and make sure it is migrated. */
export default function setup() {
  const url =
    process.env.TEST_DATABASE_URL ?? "postgresql://postgres@localhost:5432/split_expense_test?schema=public";
  process.env.DATABASE_URL = url;
  try {
    execSync("npx prisma migrate deploy", { stdio: "pipe", env: { ...process.env, DATABASE_URL: url } });
  } catch (err) {
    const out = (err as { stderr?: Buffer; stdout?: Buffer }).stderr?.toString() ?? "";
    throw new Error(
      `Could not migrate the test database (${url}). Create it or set TEST_DATABASE_URL.\n${out}`,
    );
  }
}
