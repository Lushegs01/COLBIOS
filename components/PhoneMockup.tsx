import Image from "next/image";
import { BatteryFull, Signal, Wifi } from "lucide-react";

/**
 * A realistic smartphone built entirely with HTML/CSS so it stays crisp
 * at every resolution. The screen shows a real screenshot of the app.
 * Purely decorative — hidden from assistive tech.
 */
export default function PhoneMockup({ className = "" }: { className?: string }) {
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
        <div className="relative overflow-hidden rounded-[2.7rem] bg-white">
          {/* Status bar strip with dynamic island */}
          <div className="relative flex h-11 items-center justify-between bg-black px-7 text-[11px] font-semibold text-white">
            <span>9:41</span>
            <span className="flex items-center gap-1.5 text-white/90">
              <Signal size={12} strokeWidth={2.4} />
              <Wifi size={12} strokeWidth={2.4} />
              <BatteryFull size={15} strokeWidth={1.8} />
            </span>
            <div className="absolute left-1/2 top-2.5 h-[17px] w-[80px] -translate-x-1/2 rounded-full bg-black ring-1 ring-white/15" />
          </div>

          {/* App screenshot — kept at its natural aspect so nothing is cropped */}
          <div className="relative aspect-[629/1280]">
            <Image
              src="/hero-phone-screen.jpeg"
              alt=""
              fill
              priority
              className="object-cover"
              sizes="(min-width: 640px) 326px, 300px"
            />
          </div>
        </div>
      </div>
    </div>
  );
}
