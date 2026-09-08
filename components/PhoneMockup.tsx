import {
  BadgeCheck,
  BatteryFull,
  GraduationCap,
  Signal,
  Wifi,
} from "lucide-react";
import { paymentMethods, siteConfig } from "@/lib/site";

/**
 * A realistic smartphone built entirely with HTML/CSS so it stays crisp
 * at every resolution. Purely decorative — hidden from assistive tech.
 */
export default function PhoneMockup({
  className = "",
  sessionName,
  amountLabel,
}: {
  className?: string;
  sessionName: string | null;
  amountLabel: string | null;
}) {
  return (
    <div
      aria-hidden="true"
      className={`relative w-[300px] select-none sm:w-[326px] ${className}`}
    >
      {/* Device frame */}
      <div className="relative rounded-[3.4rem] bg-neutral-900 p-[11px] shadow-device ring-1 ring-black/15">
        {/* Side buttons */}
        <div className="absolute -left-[2.5px] top-28 h-10 w-[3px] rounded-l-md bg-neutral-800" />
        <div className="absolute -left-[2.5px] top-44 h-16 w-[3px] rounded-l-md bg-neutral-800" />
        <div className="absolute -right-[2.5px] top-36 h-20 w-[3px] rounded-r-md bg-neutral-800" />

        {/* Screen */}
        <div className="relative overflow-hidden rounded-[2.7rem] bg-[#F6F7F3]">
          {/* Dynamic island */}
          <div className="absolute left-1/2 top-2.5 z-10 h-[22px] w-[92px] -translate-x-1/2 rounded-full bg-black" />

          {/* Status bar */}
          <div className="flex items-center justify-between px-7 pt-3.5 text-[11px] font-semibold text-ink">
            <span>9:41</span>
            <span className="flex items-center gap-1.5 text-ink/80">
              <Signal size={12} strokeWidth={2.4} />
              <Wifi size={12} strokeWidth={2.4} />
              <BatteryFull size={15} strokeWidth={1.8} />
            </span>
          </div>

          {/* App content */}
          <div className="px-5 pb-8 pt-12">
            {/* App header */}
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[15px] font-semibold tracking-tight text-ink">
                  COLBIOS<span className="text-pine-600">.</span>
                </p>
                <p className="mt-0.5 text-[11px] text-muted">
                  {sessionName ?? siteConfig.session} Session
                </p>
              </div>
              <div className="grid h-9 w-9 place-items-center rounded-full bg-white text-pine-700 ring-1 ring-line">
                <GraduationCap size={16} strokeWidth={2} />
              </div>
            </div>

            {/* Dues card */}
            <div className="mt-6 rounded-[1.4rem] bg-white p-5 shadow-soft ring-1 ring-line">
              <div className="flex items-center justify-between">
                <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-muted">
                  Student dues
                </p>
                <span className="rounded-full bg-pine-50 px-2.5 py-1 text-[10px] font-medium text-pine-700">
                  Dues payment
                </span>
              </div>
              <p className="mt-4 text-[11px] text-muted">Amount due</p>
              <p className="mt-1 text-[30px] font-semibold tracking-tight text-ink">
                {amountLabel ?? "Set by level"}
              </p>
              <div className="mt-4 flex h-11 items-center justify-center rounded-full bg-pine-700 text-[13px] font-medium text-white">
                {amountLabel ? `Pay ${amountLabel.replace("from ", "")}` : "Pay dues"}
              </div>
            </div>

            {/* Payment methods */}
            <p className="mt-6 text-[10px] font-semibold uppercase tracking-[0.08em] text-muted">
              Payment methods
            </p>
            <div className="mt-2.5 grid grid-cols-3 gap-1.5">
              {paymentMethods.map((method, i) => (
                <div
                  key={method.id}
                  className={`flex h-9 items-center justify-center rounded-xl text-[10.5px] font-medium ${
                    i === 0
                      ? "bg-ink text-white"
                      : "bg-white text-muted ring-1 ring-line"
                  }`}
                >
                  {method.label}
                </div>
              ))}
            </div>

            {/* Recent payment */}
            <div className="mt-6 rounded-[1.4rem] bg-white p-4 shadow-xs ring-1 ring-line">
              <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-muted">
                Recent payment
              </p>
              <div className="mt-2.5 flex items-center justify-between">
                <div>
                  <p className="text-[13px] font-medium text-ink">
                    COLBIOS dues
                  </p>
                  <p className="mt-0.5 text-[11px] text-muted">
                    {amountLabel?.replace("from ", "") ?? "Paid in full"}
                  </p>
                </div>
                <span className="flex items-center gap-1 rounded-full bg-pine-50 px-2.5 py-1 text-[10px] font-medium text-pine-700">
                  <BadgeCheck size={12} strokeWidth={2.4} />
                  Paid
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
