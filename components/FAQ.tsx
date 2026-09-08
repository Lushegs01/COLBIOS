"use client";

import { AnimatePresence, motion } from "framer-motion";
import { ChevronDown, Mail, MessageCircle } from "lucide-react";
import { useState } from "react";
import { faqs, siteConfig } from "@/lib/site";
import PayDuesButton from "./PayDuesButton";

export default function FAQ() {
  const [openIndex, setOpenIndex] = useState<number | null>(0);

  return (
    <section id="faq" className="scroll-mt-24 py-24 sm:py-32">
      <div className="mx-auto max-w-6xl px-5 sm:px-6">

        {/* ── Two-column layout ── */}
        <div className="grid gap-10 lg:grid-cols-[1fr_1.4fr] lg:gap-16 lg:items-start">

          {/* ── Left: sticky brand panel ── */}
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6, ease: [0.21, 0.47, 0.32, 0.98] }}
            className="lg:sticky lg:top-28"
          >
            {/* Badge */}
            <span className="inline-flex items-center gap-2 rounded-full border border-pine-200/70 bg-pine-50 px-3.5 py-1.5 text-[11px] font-semibold uppercase tracking-[0.1em] text-pine-700">
              <MessageCircle size={11} strokeWidth={2.5} />
              FAQ
            </span>

            <h2 className="mt-5 text-balance text-3xl font-semibold tracking-[-0.03em] text-ink sm:text-4xl md:text-[40px] md:leading-[1.1]">
              Questions,{" "}
              <span
                style={{
                  background: "linear-gradient(135deg, #0f6b51 0%, #5FA489 100%)",
                  WebkitBackgroundClip: "text",
                  WebkitTextFillColor: "transparent",
                  backgroundClip: "text",
                }}
              >
                answered.
              </span>
            </h2>

            <p className="mt-4 text-[15px] leading-relaxed text-muted">
              Everything students usually ask before paying their COLBIOS dues.
            </p>

            {/* Support card */}
            <div className="mt-8 overflow-hidden rounded-2xl border border-line bg-white shadow-xs">
              {/* Green top bar */}
              <div className="h-1.5 w-full bg-gradient-to-r from-pine-600 to-pine-400" />
              <div className="p-5">
                <div className="flex items-center gap-3">
                  <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-pine-50 text-pine-700">
                    <Mail size={15} strokeWidth={2.2} />
                  </span>
                  <div>
                    <p className="text-[13px] font-semibold text-ink">Still need help?</p>
                    <p className="text-[12px] text-muted">We reply within 24 hours</p>
                  </div>
                </div>
                <a
                  href={`mailto:${siteConfig.supportEmail}`}
                  className="mt-4 inline-flex w-full items-center justify-center rounded-full border border-line bg-white px-5 py-2.5 text-[13px] font-medium text-ink shadow-xs transition-all duration-200 hover:border-pine-300 hover:text-pine-700 hover:shadow-soft"
                >
                  Email us →
                </a>
              </div>
            </div>

            {/* CTA */}
            <div className="mt-5">
              <PayDuesButton size="lg" className="w-full justify-center shadow-[0_4px_20px_rgba(15,107,81,0.25)]">
                Pay dues now
              </PayDuesButton>
            </div>
          </motion.div>

          {/* ── Right: accordion ── */}
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.65, delay: 0.1, ease: [0.21, 0.47, 0.32, 0.98] }}
            className="divide-y divide-line overflow-hidden rounded-3xl border border-line bg-white shadow-xs"
          >
            {faqs.map((faq, i) => {
              const isOpen = openIndex === i;
              return (
                <div
                  key={faq.question}
                  className={`transition-colors duration-200 ${isOpen ? "bg-pine-50/60" : "bg-white"}`}
                >
                  <h3>
                    <button
                      type="button"
                      onClick={() => setOpenIndex(isOpen ? null : i)}
                      aria-expanded={isOpen}
                      aria-controls={`faq-panel-${i}`}
                      id={`faq-button-${i}`}
                      className="flex w-full items-center justify-between gap-4 px-6 py-5 text-left sm:px-7 sm:py-6"
                    >
                      <div className="flex items-center gap-4 min-w-0">
                        {/* Step number */}
                        <span className={`shrink-0 text-[11px] font-bold tabular-nums transition-colors duration-200 ${isOpen ? "text-pine-600" : "text-line"}`}>
                          {String(i + 1).padStart(2, "0")}
                        </span>
                        <span className={`text-[15px] font-medium transition-colors duration-200 sm:text-base ${isOpen ? "text-pine-800" : "text-ink"}`}>
                          {faq.question}
                        </span>
                      </div>

                      {/* Chevron in circle */}
                      <span className={`grid h-7 w-7 shrink-0 place-items-center rounded-full transition-all duration-300 ${isOpen ? "bg-pine-600 text-white" : "bg-pine-50 text-pine-600"}`}>
                        <ChevronDown
                          size={14}
                          strokeWidth={2.5}
                          aria-hidden="true"
                          className={`transition-transform duration-300 ${isOpen ? "rotate-180" : ""}`}
                        />
                      </span>
                    </button>
                  </h3>

                  <AnimatePresence initial={false}>
                    {isOpen && (
                      <motion.div
                        id={`faq-panel-${i}`}
                        role="region"
                        aria-labelledby={`faq-button-${i}`}
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: "auto", opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.3, ease: [0.21, 0.47, 0.32, 0.98] }}
                        className="overflow-hidden"
                      >
                        <p className="px-6 pb-6 pl-[3.75rem] text-[14px] leading-relaxed text-muted sm:px-7 sm:pb-7 sm:pl-[4rem]">
                          {faq.answer}
                        </p>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              );
            })}
          </motion.div>

        </div>
      </div>
    </section>
  );
}
