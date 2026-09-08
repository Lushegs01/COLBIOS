import "dotenv/config";
import { createInterface } from "node:readline/promises";
import { stdin, stdout } from "node:process";

import { createScriptClient } from "../prisma/client";
import { hashPassword } from "../lib/auth/password";
import { adminPasswordSchema, emailSchema } from "../lib/validation/schemas";

/**
 * Creates the first administrator account.
 *
 * There are no default credentials anywhere in this codebase — no
 * admin@example.com, no seeded password. The first account is created here,
 * from values supplied by the operator at run time, and the password policy is
 * the same one the application enforces everywhere else.
 *
 * Usage:
 *   npm run admin:bootstrap                 (interactive prompts)
 *   ADMIN_EMAIL=… ADMIN_NAME=… ADMIN_PASSWORD=… npm run admin:bootstrap
 */

const PLACEHOLDER_EMAILS = [
  "admin@example.com",
  "test@example.com",
  "user@example.com",
  "admin@admin.com",
];

async function prompt(question: string, mask = false): Promise<string> {
  const rl = createInterface({ input: stdin, output: stdout, terminal: true });
  try {
    if (!mask) return (await rl.question(question)).trim();

    // Minimal masking: keep the password off the terminal scrollback.
    const output = stdout as NodeJS.WriteStream & { muted?: boolean };
    const originalWrite = output.write.bind(output);
    let muted = false;
    output.write = ((chunk: string | Uint8Array, ...args: unknown[]) => {
      if (muted && typeof chunk === "string" && !chunk.includes("\n")) return true;
      return (originalWrite as (c: unknown, ...a: unknown[]) => boolean)(chunk, ...args);
    }) as typeof output.write;

    const answer = rl.question(question);
    muted = true;
    const value = (await answer).trim();
    muted = false;
    output.write = originalWrite;
    stdout.write("\n");
    return value;
  } finally {
    rl.close();
  }
}

async function main() {
  const prisma = createScriptClient();

  try {
    const email = process.env.ADMIN_EMAIL ?? (await prompt("Administrator email: "));
    const name = process.env.ADMIN_NAME ?? (await prompt("Full name: "));
    const password = process.env.ADMIN_PASSWORD ?? (await prompt("Password: ", true));

    const parsedEmail = emailSchema.safeParse(email);
    if (!parsedEmail.success) {
      fail(`Invalid email address: ${parsedEmail.error.issues[0]?.message ?? "unknown error"}`);
    }
    if (PLACEHOLDER_EMAILS.includes(parsedEmail.data)) {
      fail("Refusing to create an account with a placeholder email address.");
    }

    if (!name || name.trim().length < 3) fail("Enter the administrator's full name.");

    const parsedPassword = adminPasswordSchema.safeParse(password);
    if (!parsedPassword.success) {
      console.error("\nThat password does not meet the policy:");
      for (const issue of parsedPassword.error.issues) console.error(`  • ${issue.message}`);
      process.exit(1);
    }

    const existing = await prisma.adminUser.findUnique({ where: { email: parsedEmail.data } });
    if (existing) {
      fail(
        `An administrator with the email ${parsedEmail.data} already exists. Use the admin dashboard to change their password or role.`,
      );
    }

    const isFirstAdmin = (await prisma.adminUser.count()) === 0;

    const admin = await prisma.adminUser.create({
      data: {
        email: parsedEmail.data,
        name: name.trim(),
        passwordHash: await hashPassword(parsedPassword.data),
        // The very first account has to be able to create the others.
        role: isFirstAdmin ? "SUPER_ADMIN" : "ADMIN",
        active: true,
      },
    });

    await prisma.auditLog.create({
      data: {
        action: "CREATE_ADMIN",
        entityType: "AdminUser",
        entityId: admin.id,
        adminEmail: admin.email,
        metadata: { role: admin.role, createdVia: "bootstrap-script" },
      },
    });

    console.log(
      [
        "",
        `Created ${admin.role} account for ${admin.email}.`,
        "",
        "Sign in at /admin/login. Store the password in your password manager —",
        "it is not written anywhere and cannot be recovered from the database.",
        "",
      ].join("\n"),
    );
  } finally {
    await prisma.$disconnect();
  }
}

function fail(message: string): never {
  console.error(`\n${message}\n`);
  process.exit(1);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
