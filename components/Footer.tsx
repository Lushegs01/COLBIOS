import { siteConfig } from "@/lib/site";

const footerLinks = [
  { label: "Payment", href: siteConfig.paymentUrl },
  { label: "Help", href: "#faq" },
  { label: "FAQ", href: "#faq" },
  { label: "Contact", href: `mailto:${siteConfig.supportEmail}` },
];

export default function Footer() {
  return (
    <footer id="contact" className="relative overflow-hidden rounded-t-3xl">

      {/* ── Hero-matched green background ── */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 bg-gradient-to-b from-[#d6ede4] via-[#eef7f3] to-[#f4faf7]"
      />
      {/* Left aurora blob */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -left-24 -top-10 h-64 w-64 rounded-full bg-pine-300/50 blur-[90px]"
      />
      {/* Right aurora blob */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -right-16 bottom-0 h-52 w-52 rounded-full bg-pine-400/30 blur-[80px]"
      />
      {/* Dot-grid texture */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0"
        style={{
          backgroundImage: "radial-gradient(circle, #0f6b5130 1px, transparent 1px)",
          backgroundSize: "24px 24px",
          maskImage: "radial-gradient(ellipse 100% 100% at 50% 0%, black 60%, transparent 100%)",
          WebkitMaskImage: "radial-gradient(ellipse 100% 100% at 50% 0%, black 60%, transparent 100%)",
        }}
      />

      {/* ── Content ── */}
      <div className="relative mx-auto max-w-6xl px-5 py-8 sm:px-6">
        <div className="flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-[15px] font-semibold tracking-tight text-ink">
              COLBIOS<span className="text-pine-600">.</span>
            </p>
            <p className="mt-1 text-[13px] leading-relaxed text-muted">
              {siteConfig.institution} · {siteConfig.university}
            </p>
          </div>

          <nav aria-label="Footer">
            <ul className="flex flex-wrap gap-x-7 gap-y-2 text-[13px]">
              {footerLinks.map((link) => (
                <li key={link.label}>
                  <a
                    href={link.href}
                    className="text-muted transition-colors duration-150 hover:text-pine-700"
                  >
                    {link.label}
                  </a>
                </li>
              ))}
            </ul>
          </nav>
        </div>

        <div className="mt-6 flex flex-col gap-1 text-[12px] text-muted/70 sm:flex-row sm:items-center sm:justify-between">
          <p>© 2026 COLBIOS. All rights reserved.</p>
          <p>A payment channel for College of Biosciences dues.</p>
        </div>
      </div>
    </footer>
  );
}

