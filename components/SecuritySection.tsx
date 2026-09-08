import { BadgeCheck, FileText, Lock } from "lucide-react";
import Reveal from "./Reveal";

const items = [
  {
    icon: Lock,
    title: "Secure checkout",
    description:
      "Your payment is completed on a secure payment page, away from this site.",
  },
  {
    icon: BadgeCheck,
    title: "Payment confirmation",
    description:
      "You see clear confirmation as soon as your payment goes through.",
  },
  {
    icon: FileText,
    title: "Digital receipt",
    description:
      "Every successful payment generates a receipt you can come back to.",
  },
];

export default function SecuritySection() {
  return (
    <section
      id="security"
      className="scroll-mt-24 border-y border-line/70 bg-pine-50/50 py-24 sm:py-32"
    >
      <div className="mx-auto max-w-6xl px-5 sm:px-6">
        <Reveal className="mx-auto max-w-2xl text-center">
          <h2 className="text-balance text-3xl font-semibold tracking-[-0.025em] text-ink sm:text-4xl md:text-[42px] md:leading-[1.1]">
            Your payment. Your record.
          </h2>
          <p className="mt-4 text-lg leading-relaxed text-muted">
            Your payment information is handled through a secure payment flow,
            with confirmation available after successful payment.
          </p>
        </Reveal>

        <ul className="mx-auto mt-14 grid max-w-4xl list-none gap-5 sm:grid-cols-3">
          {items.map((item, i) => (
            <li key={item.title}>
              <Reveal delay={i * 0.09} className="h-full">
                <div className="flex h-full flex-col items-center rounded-3xl border border-line bg-white px-7 py-9 text-center transition-shadow duration-300 hover:shadow-soft">
                  <span className="grid h-12 w-12 place-items-center rounded-2xl bg-pine-50 text-pine-700">
                    <item.icon size={22} strokeWidth={1.9} />
                  </span>
                  <h3 className="mt-5 text-base font-semibold text-ink">
                    {item.title}
                  </h3>
                  <p className="mt-1.5 text-sm leading-relaxed text-muted">
                    {item.description}
                  </p>
                </div>
              </Reveal>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
