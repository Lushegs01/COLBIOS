"use client";

import { MotionConfig } from "framer-motion";

/**
 * Wraps the page so every Framer Motion animation automatically
 * respects the user's prefers-reduced-motion setting.
 */
export default function MotionProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  return <MotionConfig reducedMotion="user">{children}</MotionConfig>;
}
