"use client";

import { AnimatePresence, motion } from "framer-motion";
import { Menu, X } from "lucide-react";
import { useEffect, useState } from "react";
import { siteConfig } from "@/lib/site";
import PayDuesButton from "./PayDuesButton";

const navLinks = [
  { label: "Home", href: "#top" },
  { label: "How it works", href: "#how-it-works" },
  { label: "Help", href: "#faq" },
];

export default function Navbar() {
  const [scrolled, setScrolled] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <header className="sticky top-0 z-50 w-full">
      <div className="mx-auto max-w-6xl px-4 pt-4 sm:px-6">
        <nav
          aria-label="Main"
          className={`flex h-14 items-center justify-between rounded-2xl border px-4 transition-all duration-300 sm:px-5 ${
            scrolled || menuOpen
              ? "border-line bg-white/75 shadow-soft backdrop-blur-xl"
              : "border-transparent bg-transparent"
          }`}
        >
          <a
            href="#top"
            className="text-[17px] font-semibold tracking-tight text-ink"
            aria-label="COLBIOS — back to top"
          >
            COLBIOS<span className="text-pine-600">.</span>
          </a>

          <ul className="hidden items-center gap-1 md:flex">
            {navLinks.map((link) => (
              <li key={link.label}>
                <a
                  href={link.href}
                  className="rounded-full px-3.5 py-2 text-sm text-muted transition-colors hover:bg-ink/[0.04] hover:text-ink"
                >
                  {link.label}
                </a>
              </li>
            ))}
          </ul>

          <div className="flex items-center gap-2.5">
            <a
              href={siteConfig.paymentUrl}
              className="hidden rounded-full border border-line bg-white px-4 py-2 text-[13px] font-medium text-ink shadow-xs transition-colors hover:border-ink/30 sm:inline-flex"
            >
              Check payment
            </a>
            <PayDuesButton size="sm">
              Pay dues
            </PayDuesButton>
            <button
              type="button"
              onClick={() => setMenuOpen((v) => !v)}
              aria-expanded={menuOpen}
              aria-controls="mobile-menu"
              aria-label={menuOpen ? "Close menu" : "Open menu"}
              className="grid h-9 w-9 place-items-center rounded-full text-ink transition-colors hover:bg-ink/[0.05] md:hidden"
            >
              {menuOpen ? <X size={19} /> : <Menu size={19} />}
            </button>
          </div>
        </nav>

        <AnimatePresence>
          {menuOpen && (
            <motion.div
              id="mobile-menu"
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.2 }}
              className="mt-2 rounded-2xl border border-line bg-white p-3 shadow-lift md:hidden"
            >
              <ul className="flex flex-col">
                {navLinks.map((link) => (
                  <li key={link.label}>
                    <a
                      href={link.href}
                      onClick={() => setMenuOpen(false)}
                      className="block rounded-xl px-4 py-3 text-[15px] font-medium text-ink transition-colors hover:bg-ink/[0.04]"
                    >
                      {link.label}
                    </a>
                  </li>
                ))}
                <li>
                  <a
                    href={siteConfig.paymentUrl}
                    onClick={() => setMenuOpen(false)}
                    className="block rounded-xl px-4 py-3 text-[15px] font-medium text-muted transition-colors hover:bg-ink/[0.04]"
                  >
                    Check payment
                  </a>
                </li>
              </ul>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </header>
  );
}
