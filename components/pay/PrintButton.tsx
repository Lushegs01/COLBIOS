"use client";

import { buttonClass } from "@/components/ui/Button";

/**
 * Printing needs `window.print()`, so this one control is a client component.
 * It is rendered only on the receipt page and is hidden when printing, so the
 * rest of that page stays server-rendered and JavaScript-free.
 */
export function PrintButton() {
  return (
    <button type="button" onClick={() => window.print()} className={buttonClass("secondary", "sm")}>
      Print
    </button>
  );
}
