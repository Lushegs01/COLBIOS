import { siteConfig } from "@/lib/site";
import PayDuesButton from "./PayDuesButton";
import Reveal from "./Reveal";

export default function FinalCTA() {
  return (
    <section className="px-4 pb-24 sm:px-6 sm:pb-32">
      <Reveal className="mx-auto max-w-6xl">
        <div className="relative overflow-hidden rounded-[2rem] bg-pine-800 px-6 py-20 text-center sm:px-16 sm:py-24">
          {/* Soft light from above */}
          <div
            aria-hidden="true"
            className="pointer-events-none absolute left-1/2 top-[-220px] h-[420px] w-[560px] -translate-x-1/2 rounded-full bg-pine-500/25 blur-3xl"
          />
          <div className="relative">
            <p className="text-sm font-medium text-pine-200">
              {siteConfig.session} session
            </p>
            <h2 className="mt-3 text-balance text-4xl font-semibold tracking-[-0.03em] text-white sm:text-5xl">
              Ready to get cleared?
            </h2>
            <p className="mx-auto mt-4 max-w-md text-balance text-lg leading-relaxed text-pine-100/80">
              Pay your COLBIOS dues online and get back to what matters.
            </p>
            <div className="mt-9">
              <PayDuesButton variant="onDark" size="lg">
                Pay dues now
              </PayDuesButton>
            </div>
          </div>
        </div>
      </Reveal>
    </section>
  );
}
