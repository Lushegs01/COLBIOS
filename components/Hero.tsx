"use client";

import Image from "next/image";
import { motion } from "framer-motion";
import { BadgeCheck, Check, FileText, UserCheck, Wallet } from "lucide-react";
import FloatingCard from "./FloatingCard";
import PayDuesButton from "./PayDuesButton";
import PhoneMockup from "./PhoneMockup";

const fadeUp = {
  hidden: { opacity: 0, y: 24 },
  show: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.65, ease: [0.21, 0.47, 0.32, 0.98] as const },
  },
};

// Real photos of Black students — sourced from Unsplash (free to use)
const STUDENT_AVATARS = [
  {
    src: "https://images.unsplash.com/photo-1531123897727-8f129e1688ce?w=64&h=64&fit=crop&crop=face&auto=format",
    alt: "Student 1",
  },
  {
    src: "https://images.unsplash.com/photo-1607990281513-2c110a25bd8c?w=64&h=64&fit=crop&crop=face&auto=format",
    alt: "Student 2",
  },
  {
    src: "https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=64&h=64&fit=crop&crop=face&auto=format",
    alt: "Student 3",
  },
  {
    src: "https://images.unsplash.com/photo-1522529599102-193c0d76b5b6?w=64&h=64&fit=crop&crop=face&auto=format",
    alt: "Student 4",
  },
];

type HeroProps = {
  /** Live configuration — the landing page never states an amount of its own. */
  sessionName: string | null;
  amountLabel: string | null;
};

export default function Hero({ sessionName, amountLabel }: HeroProps) {
  return (
    <section id="top" className="relative overflow-x-clip pb-24 pt-32 sm:pt-44">
      {/* ── Background layer ── */}
      {/* Base gradient — richer green top */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 bg-gradient-to-b from-[#d6ede4] via-[#eef7f3] to-[#FAFAF8]"
      />

      {/* Top-left aurora blob — boosted */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -left-32 -top-20 h-[560px] w-[560px] rounded-full bg-pine-300/60 blur-[110px]"
      />

      {/* Top-right aurora blob — boosted */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -right-20 top-0 h-[480px] w-[480px] rounded-full bg-pine-400/35 blur-[90px]"
      />

      {/* Central glow behind phone — richer */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute left-1/2 top-[50%] h-[560px] w-[min(960px,130vw)] -translate-x-1/2 rounded-full bg-pine-200/80 blur-[70px]"
      />

      {/* Subtle dot-grid texture — more visible */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0"
        style={{
          backgroundImage:
            "radial-gradient(circle, #0f6b5130 1px, transparent 1px)",
          backgroundSize: "28px 28px",
          maskImage:
            "radial-gradient(ellipse 80% 60% at 50% 0%, black 40%, transparent 100%)",
          WebkitMaskImage:
            "radial-gradient(ellipse 80% 60% at 50% 0%, black 40%, transparent 100%)",
        }}
      />

      {/* ── Content ── */}
      <div className="relative mx-auto max-w-6xl px-5 sm:px-6">
        <motion.div
          initial="hidden"
          animate="show"
          variants={{ show: { transition: { staggerChildren: 0.09 } } }}
          className="mx-auto max-w-3xl text-center"
        >
          {/* Badge */}
          <motion.div variants={fadeUp}>
            <span className="inline-flex items-center gap-2 rounded-full border border-pine-200/70 bg-white/80 py-1.5 pl-3 pr-4 text-[13px] font-medium text-pine-700 shadow-[0_0_0_3px_rgba(15,107,81,0.06)] backdrop-blur-sm">
              <span className="relative flex h-1.5 w-1.5">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-pine-400 opacity-70" />
                <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-pine-500" />
              </span>
              {sessionName ? `${sessionName} dues are now open` : "Dues payment opens soon"}
            </span>
          </motion.div>

          {/* Headline */}
          <motion.h1
            variants={fadeUp}
            className="mt-7 text-balance text-[44px] font-semibold leading-[1.04] tracking-[-0.04em] text-ink sm:text-6xl md:text-7xl lg:text-[78px]"
          >
            Pay your dues.
            <br />
            Stay{" "}
            <span
              className="relative inline-block"
              style={{
                background:
                  "linear-gradient(135deg, #0f6b51 0%, #2F8567 50%, #5FA489 100%)",
                WebkitBackgroundClip: "text",
                WebkitTextFillColor: "transparent",
                backgroundClip: "text",
              }}
            >
              cleared
            </span>
            <span className="text-pine-500">.</span>
          </motion.h1>

          {/* Subtext */}
          <motion.p
            variants={fadeUp}
            className="mx-auto mt-6 max-w-[480px] text-balance text-[17px] leading-relaxed text-muted sm:text-lg"
          >
            Make your COLBIOS dues payment online — securely and without the
            queue. Pay, confirm your status, and receive your receipt.
          </motion.p>

          {/* CTAs */}
          <motion.div
            variants={fadeUp}
            className="mt-10 flex flex-col items-center justify-center gap-3 sm:flex-row"
          >
            {/* Primary CTA with glow */}
            <span className="relative">
              <span
                aria-hidden="true"
                className="pointer-events-none absolute inset-0 rounded-full bg-pine-600/30 blur-lg transition-all duration-300 group-hover:blur-xl"
              />
              <PayDuesButton size="lg" className="relative w-full shadow-[0_4px_24px_rgba(15,107,81,0.35)] hover:shadow-[0_6px_32px_rgba(15,107,81,0.50)] sm:w-auto">
                Pay dues now
              </PayDuesButton>
            </span>

            <a
              href="#how-it-works"
              className="inline-flex w-full items-center justify-center rounded-full border border-line bg-white/80 px-7 py-3.5 text-[15px] font-medium text-ink shadow-xs backdrop-blur-sm transition-all duration-200 hover:border-ink/25 hover:bg-white hover:shadow-soft sm:w-auto"
            >
              How it works
            </a>
          </motion.div>

          {/* Social proof micro-strip */}
          <motion.div
            variants={fadeUp}
            className="mt-8 flex items-center justify-center gap-2.5 text-[13px] text-muted"
          >
            <span className="flex -space-x-2">
              {STUDENT_AVATARS.map((avatar, i) => (
                <span
                  key={i}
                  className="relative inline-block h-7 w-7 overflow-hidden rounded-full ring-2 ring-white"
                >
                  <Image
                    src={avatar.src}
                    alt={avatar.alt}
                    fill
                    className="object-cover"
                    sizes="28px"
                    unoptimized
                  />
                </span>
              ))}
            </span>
            <span>Trusted by <strong className="font-semibold text-ink">500+</strong> COLBIOS students</span>
          </motion.div>
        </motion.div>

        {/* ── Phone stage ── */}
        <div className="relative mx-auto mt-16 max-w-3xl sm:mt-20">
          {/* Layered glow halos behind phone — boosted green */}
          <div
            aria-hidden="true"
            className="pointer-events-none absolute left-1/2 top-1/2 h-[380px] w-[380px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-pine-400/35 blur-[55px]"
          />
          <div
            aria-hidden="true"
            className="pointer-events-none absolute left-1/2 top-1/2 h-[220px] w-[220px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-pine-500/25 blur-[28px]"
          />

          <motion.div
            initial={{ opacity: 0, y: 44, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{
              duration: 0.8,
              delay: 0.35,
              ease: [0.21, 0.47, 0.32, 0.98],
            }}
            className="relative z-10 flex justify-center"
          >
            <PhoneMockup />
          </motion.div>

          {/* Card 1 — Payment methods */}
          <FloatingCard
            className="left-[-2%] top-10 hidden md:block lg:left-[1%]"
            delay={0.55}
            floatDelay={0}
          >
            <div className="flex items-start gap-2.5">
              <span className="grid h-8 w-8 shrink-0 place-items-center rounded-xl bg-gradient-to-br from-pine-500 to-pine-700 text-white shadow-sm">
                <Wallet size={14} strokeWidth={2.2} />
              </span>
              <div>
                <p className="text-[12px] font-semibold text-ink">
                  Payment methods
                </p>
                <ul className="mt-1 space-y-1 text-[11px] text-muted">
                  {["Card", "Bank Transfer", "USSD"].map((m) => (
                    <li key={m} className="flex items-center gap-1.5">
                      <Check
                        size={11}
                        strokeWidth={3}
                        className="text-pine-600"
                      />
                      {m}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </FloatingCard>

          {/* Card 2 — Payment confirmed */}
          <FloatingCard
            className="right-[-2%] top-28 hidden md:block lg:right-[0%]"
            delay={0.68}
            floatDelay={0.9}
          >
            <div className="flex items-start gap-2.5">
              <span className="grid h-8 w-8 shrink-0 place-items-center rounded-xl bg-gradient-to-br from-pine-500 to-pine-700 text-white shadow-sm">
                <BadgeCheck size={15} strokeWidth={2.2} />
              </span>
              <div>
                <p className="text-[12px] font-semibold text-ink">
                  Payment confirmed
                </p>
                <p className="mt-1 text-[11px] text-muted">
                  COLBIOS dues{amountLabel ? ` · ${amountLabel}` : ""}
                </p>
                <span className="mt-1.5 inline-flex items-center gap-1 rounded-full bg-pine-50 px-2 py-0.5 text-[10px] font-semibold text-pine-700 ring-1 ring-pine-200/60">
                  <Check size={10} strokeWidth={3} />
                  Successful
                </span>
              </div>
            </div>
          </FloatingCard>

          {/* Card 3 — Student status */}
          <FloatingCard
            className="bottom-28 left-[0%] hidden lg:block"
            delay={0.8}
            floatDelay={1.7}
          >
            <div className="flex items-center gap-2.5">
              <span className="grid h-8 w-8 shrink-0 place-items-center rounded-xl bg-gradient-to-br from-pine-500 to-pine-700 text-white shadow-sm">
                <UserCheck size={15} strokeWidth={2.2} />
              </span>
              <div>
                <p className="text-[10px] font-medium uppercase tracking-[0.08em] text-muted">
                  Student status
                </p>
                <p className="mt-0.5 flex items-center gap-1.5 text-[12px] font-semibold text-ink">
                  Dues
                  <span className="rounded-md bg-pine-700 px-1.5 py-0.5 text-[9px] font-bold tracking-wider text-white">
                    PAID
                  </span>
                </p>
              </div>
            </div>
          </FloatingCard>

          {/* Card 4 — Receipt */}
          <FloatingCard
            className="bottom-4 right-[-7%] hidden lg:block"
            delay={0.92}
            floatDelay={2.6}
          >
            <div className="flex items-center gap-2.5">
              <span className="grid h-8 w-8 shrink-0 place-items-center rounded-xl bg-gradient-to-br from-pine-500 to-pine-700 text-white shadow-sm">
                <FileText size={14} strokeWidth={2.2} />
              </span>
              <div>
                <p className="text-[12px] font-semibold text-ink">Receipt</p>
                <p className="mt-0.5 text-[11px] text-muted">
                  Payment successful · Receipt generated
                </p>
              </div>
            </div>
          </FloatingCard>
        </div>
      </div>
    </section>
  );
}
