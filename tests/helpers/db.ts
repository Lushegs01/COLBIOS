import { prisma } from "@/lib/db/prisma";
import type { LevelCode } from "@/lib/format/level";

/**
 * Test-database helpers.
 *
 * `resetDatabase` truncates rather than dropping, so the schema (and its
 * indexes) stays exactly as migrated. RESTART IDENTITY also resets the receipt
 * counter, which keeps receipt-number assertions stable between tests.
 */
export async function resetDatabase(): Promise<void> {
  await prisma.$executeRawUnsafe(`
    TRUNCATE TABLE
      "Receipt", "PaymentEvent", "Payment", "Fee", "Department",
      "AcademicSession", "AuditLog", "AdminUser", "Counter", "RateLimitBucket"
    RESTART IDENTITY CASCADE
  `);
}

export type Fixtures = Awaited<ReturnType<typeof seedFixtures>>;

/** A working configuration: one active session, one department, one fee per level. */
export async function seedFixtures(
  options: { sessionName?: string; amounts?: Partial<Record<LevelCode, number>> } = {},
) {
  const sessionName = options.sessionName ?? "2026/2027";
  const amounts: Record<LevelCode, number> = {
    L100: 500_000,
    L200: 550_000,
    L300: 600_000,
    L400: 650_000,
    L500: 700_000,
    ...options.amounts,
  };

  const session = await prisma.academicSession.create({
    data: { name: sessionName, active: true },
  });

  const department = await prisma.department.create({
    data: { name: "Biochemistry", code: "BCH", active: true },
  });

  const inactiveDepartment = await prisma.department.create({
    data: { name: "Retired Studies", code: "RET", active: false },
  });

  const fees = await Promise.all(
    (Object.keys(amounts) as LevelCode[]).map((level) =>
      prisma.fee.create({
        data: {
          sessionId: session.id,
          level,
          code: "COLBIOS_DUES",
          name: "COLBIOS Dues",
          amount: amounts[level],
          currency: "NGN",
          active: true,
        },
      }),
    ),
  );

  return { session, department, inactiveDepartment, fees, amounts };
}

export const studentSubmission = (overrides: Partial<Record<string, string>> = {}) => ({
  fullName: "John Doe",
  matricNumber: "2023/123456",
  matricNormal: "2023/123456".toUpperCase(),
  email: "john.doe@example.com",
  level: "L300" as LevelCode,
  ...overrides,
});
