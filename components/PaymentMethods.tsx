"use client";

import { motion } from "framer-motion";
import { CreditCard, Landmark, Smartphone, ArrowRight, ShieldCheck, Zap, Check } from "lucide-react";
import { paymentMethods, siteConfig } from "@/lib/site";
import PayDuesButton from "./PayDuesButton";

const iconById = {
  card: CreditCard,
  transfer: Landmark,
  ussd: Smartphone,
} as const;

// Per-method accent colours & feature tags
const methodMeta = {
  card: {
    gradient: "from-[#1a7a5e] to-[#0f6b51]",
    lightBg: "bg-pine-50",
    ring: "ring-pine-500/30",
    tags: ["Instant", "Secure", "All major banks"],
  },
  transfer: {
    gradient: "from-[#0f6b51] to-[#084234]",
    lightBg: "bg-pine-50",
    ring: "ring-pine-500/30",
    tags: ["Zero charges", "Any bank"],
  },
  ussd: {
    gradient: "from-[#084234] to-[#063026]",
    lightBg: "bg-pine-50",
    ring: "ring-pine-500/30",
    tags: ["No internet needed", "Works on all phones"],
  },
} as const;

const cardVariants = {
  hidden: { opacity: 0, x: 28 },
  show: (i: number) => ({
    opacity: 1,
    x: 0,
    transition: { duration: 0.55, delay: 0.1 + i * 0.1, ease: [0.21, 0.47, 0.32, 0.98] },
  }),
};

export default function PaymentMethods() {
  return (
    <section id="payment-methods" className="scroll-mt-24 py-24 sm:py-32">
      <div className="mx-auto max-w-6xl px-5 sm:px-6">

        {/* ── Bento split layout ── */}
        <div className="grid gap-5 lg:grid-cols-[1fr_1.15fr] lg:items-stretch">

          {/* Left panel — dark green brand block */}
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.65, ease: [0.21, 0.47, 0.32, 0.98] }}
            className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-pine-900 via-pine-800 to-pine-700 p-10 lg:p-12"
          >
            {/* Dot grid */}
            <div
              aria-hidden="true"
              className="pointer-events-none absolute inset-0"
              style={{
                backgroundImage:
                  "radial-gradient(circle, rgba(255,255,255,0.06) 1px, transparent 1px)",
                backgroundSize: "22px 22px",
              }}
            />
            {/* Glow blobs */}
            <div aria-hidden="true" className="pointer-events-none absolute -right-16 -top-16 h-64 w-64 rounded-full bg-pine-500/30 blur-[70px]" />
            <div aria-hidden="true" className="pointer-events-none absolute -bottom-12 -left-12 h-52 w-52 rounded-full bg-pine-400/20 blur-[60px]" />

            <div className="relative flex h-full flex-col">
              {/* Badge */}
              <span className="inline-flex w-fit items-center gap-2 rounded-full border border-white/15 bg-white/10 px-3.5 py-1.5 text-[11px] font-semibold uppercase tracking-[0.1em] text-pine-200 backdrop-blur-sm">
                <Zap size={11} strokeWidth={2.5} />
                Multiple options
              </span>

              {/* Headline */}
              <h2 className="mt-8 text-balance text-3xl font-semibold leading-[1.1] tracking-[-0.03em] text-white sm:text-4xl md:text-[40px]">
                Pay the way that works{" "}
                <span
                  style={{
                    background: "linear-gradient(135deg, #93C5B1 0%, #5FA489 100%)",
                    WebkitBackgroundClip: "text",
                    WebkitTextFillColor: "transparent",
                    backgroundClip: "text",
                  }}
                >
                  for you.
                </span>
              </h2>

              <p className="mt-4 max-w-sm text-[15px] leading-relaxed text-pine-200/75">
                Pick whichever option is easiest when you get to checkout. All methods are equally secure.
              </p>

              {/* Trust badges */}
              <ul className="mt-8 space-y-2.5">
                {["256-bit encrypted payments", "Instant status update", "Digital receipt included"].map((t) => (
                  <li key={t} className="flex items-center gap-2.5 text-[13px] text-pine-200/80">
                    <span className="grid h-5 w-5 shrink-0 place-items-center rounded-full bg-pine-500/40 text-pine-300">
                      <Check size={11} strokeWidth={2.8} />
                    </span>
                    {t}
                  </li>
                ))}
              </ul>

              {/* CTA */}
              <div className="mt-auto pt-10">
                <PayDuesButton
                  variant="onDark"
                  size="lg"
                  className="shadow-[0_4px_20px_rgba(0,0,0,0.3)]"
                >
                  Pay dues now
                </PayDuesButton>
              </div>
            </div>
          </motion.div>

          {/* Right panel — stacked method cards */}
          <ul className="flex list-none flex-col gap-4">
            {paymentMethods.map((method, i) => {
              const Icon = iconById[method.id];
              const meta = methodMeta[method.id];
              return (
                <motion.li
                  key={method.id}
                  custom={i}
                  initial="hidden"
                  whileInView="show"
                  viewport={{ once: true }}
                  variants={cardVariants}
                  className="flex-1"
                >
                  <div className="group flex h-full items-center gap-5 rounded-3xl border border-line bg-white px-7 py-6 transition-all duration-300 hover:-translate-y-0.5 hover:border-pine-200 hover:shadow-[0_8px_32px_rgba(15,107,81,0.10)]">

                    {/* Icon */}
                    <span className={`grid h-13 w-13 shrink-0 place-items-center rounded-2xl bg-gradient-to-br ${meta.gradient} text-white shadow-sm`}
                      style={{ height: "52px", width: "52px" }}
                    >
                      <Icon size={22} strokeWidth={1.9} />
                    </span>

                    {/* Text */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2.5">
                        <h3 className="text-[16px] font-semibold tracking-tight text-ink">
                          {method.label}
                        </h3>
                        {/* Feature tags */}
                        <span className="hidden items-center gap-1.5 sm:flex">
                          {meta.tags.slice(0, 1).map((tag) => (
                            <span
                              key={tag}
                              className="rounded-full bg-pine-50 px-2.5 py-0.5 text-[10px] font-semibold text-pine-700 ring-1 ring-pine-200/60"
                            >
                              {tag}
                            </span>
                          ))}
                        </span>
                      </div>
                      <p className="mt-1 text-[13px] leading-relaxed text-muted">
                        {method.description}
                      </p>
                    </div>

                    {/* Arrow */}
                    <ArrowRight
                      size={16}
                      strokeWidth={2}
                      className="shrink-0 text-line transition-all duration-200 group-hover:translate-x-0.5 group-hover:text-pine-600"
                    />
                  </div>
                </motion.li>
              );
            })}
          </ul>
        </div>
      </div>
    </section>
  );
}
