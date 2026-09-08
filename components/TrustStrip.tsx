import { FileCheck, ShieldCheck, Zap } from "lucide-react";
import Reveal from "./Reveal";

const indicators = [
  { icon: ShieldCheck, label: "Secure payment" },
  { icon: Zap, label: "Instant confirmation" },
  { icon: FileCheck, label: "Digital receipt" },
];

export default function TrustStrip() {
  return (
    <section aria-label="Why pay online" className="border-y border-line/80">
      <div className="mx-auto max-w-6xl px-5 py-10 sm:px-6">
        <Reveal className="flex flex-col items-center">
          <p className="text-center text-[14px] font-medium text-ink/70">
            Built for{" "}
            <span className="font-semibold text-pine-600">simple</span>,
            secure student payments.
          </p>

          {/* Pill strip — narrow, centred */}
          <ul className="mt-5 inline-flex flex-wrap items-center justify-center divide-x divide-line/60 overflow-hidden rounded-full border border-line/70 bg-white shadow-xs">
            {indicators.map(({ icon: Icon, label }) => (
              <li
                key={label}
                className="flex items-center gap-2 px-5 py-2.5 text-[13px] font-medium text-muted"
              >
                <Icon size={15} strokeWidth={2.2} className="text-pine-600" />
                {label}
              </li>
            ))}
          </ul>
        </Reveal>
      </div>
    </section>
  );
}
