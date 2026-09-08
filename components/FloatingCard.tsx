"use client";

import { motion } from "framer-motion";
import type { ReactNode } from "react";

type Props = {
  children: ReactNode;
  className?: string;
  /** Entrance delay (seconds) after the phone appears. */
  delay?: number;
  /** Offset for the continuous float so cards don't move in lockstep. */
  floatDelay?: number;
};

/**
 * A small contextual card that floats beside the phone mockup.
 * Decorative — hidden from assistive tech to avoid duplicating content.
 */
export default function FloatingCard({
  children,
  className = "",
  delay = 0,
  floatDelay = 0,
}: Props) {
  return (
    <motion.div
      aria-hidden="true"
      className={`absolute z-20 ${className}`}
      initial={{ opacity: 0, y: 22, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.55, delay, ease: [0.21, 0.47, 0.32, 0.98] }}
    >
      <motion.div
        animate={{ y: [-4, 4, -4] }}
        transition={{
          duration: 6.5,
          repeat: Infinity,
          ease: "easeInOut",
          delay: floatDelay,
        }}
        className="rounded-2xl border border-white/70 bg-white/92 p-3.5 shadow-[0_2px_4px_rgba(0,0,0,0.04),0_12px_40px_-12px_rgba(15,107,81,0.12),inset_0_1px_0_rgba(255,255,255,0.9)] backdrop-blur-md ring-1 ring-black/[0.04]"
      >
        {children}
      </motion.div>
    </motion.div>
  );
}
