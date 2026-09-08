import { createScriptClient } from "./client";

/**
 * DEVELOPMENT / TEST DATA ONLY.
 *
 * Everything this script inserts is sample data for local development. The fee
 * amounts below are NOT official COLBIOS dues — they are placeholders, and the
 * fee names say so, so a screenshot of a seeded environment can never be
 * mistaken for the real thing.
 *
 * The script refuses to run against a production environment.
 */

const SAMPLE_LABEL = "SAMPLE — DEVELOPMENT DATA";

const SESSION_NAME = "2026/2027";

const DEPARTMENTS = [
  { name: "Biochemistry", code: "BCH" },
  { name: "Microbiology", code: "MCB" },
  { name: "Biological Sciences", code: "BIO" },
  { name: "Pure and Applied Botany", code: "PAB" },
  { name: "Pure and Applied Zoology", code: "PAZ" },
];

/** Amounts are in kobo. ₦5,000 = 500_000 kobo. Placeholders only. */
const SAMPLE_FEES = [
  { level: "L100" as const, amount: 500_000 },
  { level: "L200" as const, amount: 550_000 },
  { level: "L300" as const, amount: 600_000 },
  { level: "L400" as const, amount: 650_000 },
  { level: "L500" as const, amount: 700_000 },
];

async function main() {
  if (process.env.NODE_ENV === "production" && process.env.ALLOW_PRODUCTION_SEED !== "yes") {
    throw new Error(
      "Refusing to seed sample data in production. Configure real sessions, departments and fees through the admin dashboard.",
    );
  }

  const prisma = createScriptClient();

  try {
    console.log("Seeding DEVELOPMENT / TEST DATA…\n");

    // ---- Academic session -------------------------------------------------
    const session = await prisma.academicSession.upsert({
      where: { name: SESSION_NAME },
      update: {},
      create: {
        name: SESSION_NAME,
        active: false, // activated below, after the single-active check
        startsAt: new Date("2026-09-01T00:00:00Z"),
        endsAt: new Date("2027-08-31T00:00:00Z"),
      },
    });

    // Only one session may be active (enforced by a partial unique index), so
    // stand the others down first.
    await prisma.academicSession.updateMany({
      where: { active: true, id: { not: session.id } },
      data: { active: false },
    });
    await prisma.academicSession.update({ where: { id: session.id }, data: { active: true } });
    console.log(`  session      ${session.name} (active)`);

    // ---- Departments ------------------------------------------------------
    for (const department of DEPARTMENTS) {
      await prisma.department.upsert({
        where: { code: department.code },
        update: { name: department.name, active: true },
        create: { ...department, active: true },
      });
      console.log(`  department   ${department.code}  ${department.name}`);
    }

    // ---- Fees -------------------------------------------------------------
    for (const fee of SAMPLE_FEES) {
      const existing = await prisma.fee.findFirst({
        where: { sessionId: session.id, level: fee.level, code: "COLBIOS_DUES", active: true },
      });

      if (existing) {
        await prisma.fee.update({
          where: { id: existing.id },
          data: { amount: fee.amount, name: `COLBIOS Dues (${SAMPLE_LABEL})` },
        });
      } else {
        await prisma.fee.create({
          data: {
            sessionId: session.id,
            level: fee.level,
            code: "COLBIOS_DUES",
            name: `COLBIOS Dues (${SAMPLE_LABEL})`,
            amount: fee.amount,
            currency: "NGN",
            active: true,
          },
        });
      }

      console.log(
        `  fee          ${fee.level.slice(1)}L  ₦${(fee.amount / 100).toLocaleString("en-NG")}  (sample)`,
      );
    }

    console.log(
      [
        "",
        "Done.",
        "",
        "  ⚠  These amounts are PLACEHOLDERS, not official COLBIOS dues.",
        "     Set the real amounts in the admin dashboard under Fees before going live.",
        "",
        "  No administrator account is created by this script.",
        "  Run `npm run admin:bootstrap` to create the first one.",
        "",
      ].join("\n"),
    );
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
