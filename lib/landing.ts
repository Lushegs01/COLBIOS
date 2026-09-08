import "server-only";

import { formatMoney } from "@/lib/format/money";
import { getPaymentConfiguration } from "@/lib/payments/config";

/**
 * Live configuration for the landing page.
 *
 * The landing page used to state a single hard-coded dues amount. It now reads
 * the same configuration the payment flow uses, so it can never advertise a
 * figure the checkout would not charge — and it says nothing at all when
 * payment is not open.
 */

export type LandingConfig = {
  /** The open academic session, or null when none is active. */
  sessionName: string | null;
  /** How many levels currently have dues configured. */
  levelCount: number;
  /** "₦5,000", or "from ₦5,000" when levels differ. Null when nothing is set. */
  amountLabel: string | null;
  /** Per-level amounts, cheapest first, for the preview panels. */
  levels: Array<{ label: string; amount: string }>;
};

export async function getLandingConfig(): Promise<LandingConfig> {
  try {
    const config = await getPaymentConfiguration();
    const amounts = config.levels.map((level) => level.amount);

    if (!config.session || amounts.length === 0) {
      return {
        sessionName: config.session?.name ?? null,
        levelCount: 0,
        amountLabel: null,
        levels: [],
      };
    }

    const min = Math.min(...amounts);
    const max = Math.max(...amounts);
    const currency = config.levels[0]?.currency ?? "NGN";

    return {
      sessionName: config.session.name,
      levelCount: config.levels.length,
      amountLabel:
        min === max ? formatMoney(min, currency) : `from ${formatMoney(min, currency)}`,
      levels: config.levels.map((level) => ({
        label: level.label,
        amount: formatMoney(level.amount, level.currency),
      })),
    };
  } catch {
    // A landing page must render even if the database is briefly unreachable;
    // it simply stops quoting amounts.
    return { sessionName: null, levelCount: 0, amountLabel: null, levels: [] };
  }
}
