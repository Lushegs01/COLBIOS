"use client";

import { motion } from "framer-motion";
import { ClipboardList, CreditCard, BadgeCheck } from "lucide-react";
import { howItWorksSteps } from "@/lib/site";

const stepIcons = [ClipboardList, CreditCard, BadgeCheck];

import { Variants } from "framer-motion";

const cardVariants: Variants = {
  hidden: { opacity: 0, y: 32 },
  show: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: {
      duration: 0.6,
      delay: i * 0.12,
      ease: [0.21, 0.47, 0.32, 0.98] as const,
    },
  }),
};

export default function HowItWorks() {
  return (
    <section
      id="how-it-works"
      className="relative scroll-mt-24 overflow-hidden py-24 sm:py-32"
    >
      {/* ── Rich green background ── */}
      <div className="absolute inset-0 bg-gradient-to-br from-pine-900 via-pine-800 to-pine-700" />

      {/* Dot grid texture */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0"
        style={{
          backgroundImage:
            "radial-gradient(circle, rgba(255,255,255,0.07) 1px, transparent 1px)",
          backgroundSize: "24px 24px",
        }}
      />

      {/* Glow blobs */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -left-24 top-0 h-[400px] w-[400px] rounded-full bg-pine-500/30 blur-[100px]"
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -right-24 bottom-0 h-[350px] w-[350px] rounded-full bg-pine-600/25 blur-[90px]"
      />

      {/* ── Content ── */}
      <div className="relative mx-auto max-w-6xl px-5 sm:px-6">

        {/* Header */}
        <div className="mx-auto max-w-2xl text-center">
          <motion.span
            initial={{ opacity: 0, y: 12 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5 }}
            className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-4 py-1.5 text-[12px] font-semibold uppercase tracking-[0.1em] text-pine-200 backdrop-blur-sm"
          >
            <span className="h-1.5 w-1.5 rounded-full bg-pine-300" />
            How it works
          </motion.span>

          <motion.h2
            initial={{ opacity: 0, y: 18 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6, delay: 0.08 }}
            className="mt-5 text-balance text-3xl font-semibold tracking-[-0.03em] text-white sm:text-4xl md:text-[44px] md:leading-[1.1]"
          >
            Everything you need
            <br />
            to get cleared.
          </motion.h2>

          <motion.p
            initial={{ opacity: 0, y: 14 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6, delay: 0.14 }}
            className="mt-4 text-[17px] leading-relaxed text-pine-200/80"
          >
            Pay your dues in a few simple steps.
          </motion.p>
        </div>

        {/* Cards */}
        <ol className="mt-16 grid list-none gap-5 md:grid-cols-3">
          {howItWorksSteps.map((step, i) => {
            const Icon = stepIcons[i];
            return (
              <motion.li
                key={step.number}
                custom={i}
                initial="hidden"
                whileInView="show"
                viewport={{ once: true }}
                variants={cardVariants}
              >
                {/* Glass card */}
                <div className="group relative flex h-full flex-col overflow-hidden rounded-3xl border border-white/10 bg-white/8 p-8 backdrop-blur-md transition-all duration-300 hover:-translate-y-1 hover:border-white/20 hover:bg-white/12 hover:shadow-[0_20px_60px_rgba(0,0,0,0.3)]"
                  style={{ background: "rgba(255,255,255,0.07)" }}
                >
                  {/* Subtle inner highlight */}
                  <div
                    aria-hidden="true"
                    className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/25 to-transparent"
                  />

                  {/* Step number + icon row */}
                  <div className="flex items-start justify-between">
                    <p className="text-[52px] font-bold leading-none tracking-tighter text-white/15">
                      {step.number}
                    </p>
                    <span className="grid h-10 w-10 place-items-center rounded-2xl bg-gradient-to-br from-pine-400/40 to-pine-500/20 text-pine-200 ring-1 ring-white/10 backdrop-blur-sm">
                      <Icon size={18} strokeWidth={2} />
                    </span>
                  </div>

                  {/* Text */}
                  <h3 className="mt-8 text-[18px] font-semibold tracking-tight text-white">
                    {step.title}
                  </h3>
                  <p className="mt-2.5 text-[14px] leading-relaxed text-pine-200/70">
                    {step.description}
                  </p>

                  {/* Bottom accent line */}
                  <div className="mt-auto pt-6">
                    <div className="h-px w-full bg-gradient-to-r from-pine-400/40 via-pine-300/20 to-transparent" />
                    <p className="mt-3 text-[12px] font-semibold uppercase tracking-[0.08em] text-pine-400/70">
                      Step {step.number}
                    </p>
                  </div>
                </div>
              </motion.li>
            );
          })}
        </ol>
      </div>
    </section>
  );
}
