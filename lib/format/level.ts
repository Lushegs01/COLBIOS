/**
 * Academic level codes.
 *
 * The database stores a Postgres enum (`L100`…`L500`); students see `100L`.
 * This module is the only place that maps between the two, and it is safe to
 * import from client components (it pulls in no server code).
 *
 * Which levels a student may actually choose is *not* decided here — it comes
 * from the active fee configuration in the database.
 */

export const LEVEL_CODES = ["L100", "L200", "L300", "L400", "L500"] as const;
export type LevelCode = (typeof LEVEL_CODES)[number];

export const LEVEL_LABELS = ["100L", "200L", "300L", "400L", "500L"] as const;
export type LevelLabel = (typeof LEVEL_LABELS)[number];

export function isLevelCode(value: string): value is LevelCode {
  return (LEVEL_CODES as readonly string[]).includes(value);
}

/** "L300" -> "300L" */
export function levelLabel(code: LevelCode): LevelLabel {
  return `${code.slice(1)}L` as LevelLabel;
}

/** "300L" | "300" | "l300" -> "L300"; anything else -> null. */
export function parseLevel(input: string): LevelCode | null {
  const cleaned = input.trim().toUpperCase().replace(/\s+/g, "");
  const digits =
    /^L(\d{3})$/.exec(cleaned)?.[1] ??
    /^(\d{3})L$/.exec(cleaned)?.[1] ??
    /^(\d{3})$/.exec(cleaned)?.[1] ??
    null;

  if (!digits) return null;
  const code = `L${digits}`;
  return isLevelCode(code) ? code : null;
}

/** Sort helper so levels always render 100L → 500L. */
export function compareLevels(a: LevelCode, b: LevelCode): number {
  return LEVEL_CODES.indexOf(a) - LEVEL_CODES.indexOf(b);
}
