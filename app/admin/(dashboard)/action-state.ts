/**
 * Shared state shape for the admin server actions.
 *
 * This file deliberately has **no** `"use server"` directive. A `"use server"`
 * module may only export async functions: Next wraps every export in a runtime
 * check (`ensureServerEntryExports`, error E352) and throws when it finds a
 * value that is not a function. The `IDLE` constant below used to live in each
 * action file, which meant a client component importing it pulled a plain
 * object out of a server module and blew up the page on Vercel.
 *
 * Types are erased at compile time and are safe to export from a server module,
 * but they live here too so there is one obvious home for both.
 */

export type ActionState = {
  /** A message safe to show the administrator, or null. */
  error: string | null;
  /** Confirmation of what changed, or null. */
  success: string | null;
};

/** Starting state for every `useActionState` form in the admin area. */
export const IDLE: ActionState = { error: null, success: null };
