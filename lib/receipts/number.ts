import "server-only";

import { formatReceiptNumber } from "@/lib/payments/reference";
import type { Prisma } from "@/lib/generated/prisma/client";

/**
 * Receipt numbering.
 *
 * Numbers are gapless per year (COLBIOS-REC-2026-000001, -000002, …) and are
 * allocated from a counter row inside the *same* transaction that issues the
 * receipt. Two concurrent fulfilments therefore serialise on that row rather
 * than racing to pick the same number.
 */

export type CounterCapableClient = Pick<Prisma.TransactionClient, "counter">;

export async function nextReceiptNumber(
  tx: CounterCapableClient,
  year: number,
): Promise<string> {
  const key = `receipt:${year}`;

  const counter = await tx.counter.upsert({
    where: { key },
    create: { key, value: 1 },
    update: { value: { increment: 1 } },
    select: { value: true },
  });

  return formatReceiptNumber(year, counter.value);
}
