import { Check } from "lucide-react";
import { paymentMethods, siteConfig } from "@/lib/site";
import PayDuesButton from "./PayDuesButton";
import Reveal from "./Reveal";

const bullets = [
  "Verify your student information with your matric number",
  "See your exact amount before you pay — no surprises",
  "Choose how you want to pay at checkout",
];

type PreviewProps = { sessionName: string | null; amountLabel: string | null };

export default function PaymentPreview({ sessionName, amountLabel }: PreviewProps) {
  return (
    <section
      id="payment"
      className="scroll-mt-24 border-y border-line/70 bg-white/60 py-24 sm:py-32"
    >
      <div className="mx-auto grid max-w-6xl items-center gap-14 px-5 sm:px-6 lg:grid-cols-2 lg:gap-20">
        <Reveal>
          <p className="text-sm font-semibold uppercase tracking-[0.12em] text-pine-600">
            The checkout
          </p>
          <h2 className="mt-3 text-balance text-3xl font-semibold tracking-[-0.025em] text-ink sm:text-4xl md:text-[42px] md:leading-[1.1]">
            From due to paid in minutes.
          </h2>
          <p className="mt-5 text-lg leading-relaxed text-muted">
            See exactly what you&apos;re paying before you pay it — your
            details, your session, and your amount on one clean screen.
          </p>
          <ul className="mt-7 space-y-3">
            {bullets.map((bullet) => (
              <li
                key={bullet}
                className="flex items-start gap-3 text-[15px] text-ink/85"
              >
                <span className="mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full bg-pine-50 text-pine-700">
                  <Check size={12} strokeWidth={3} />
                </span>
                {bullet}
              </li>
            ))}
          </ul>
        </Reveal>

        <Reveal delay={0.12}>
          <div className="rounded-[28px] border border-line bg-white p-6 shadow-lift sm:p-8">
            <div className="flex items-center justify-between">
              <p className="text-[17px] font-semibold tracking-tight text-ink">
                COLBIOS<span className="text-pine-600">.</span>
              </p>
              <span className="rounded-full bg-pine-50 px-3 py-1 text-xs font-medium text-pine-700">
                Student dues
              </span>
            </div>

            <dl className="mt-6 divide-y divide-line/80 border-y border-line/80 text-sm">
              <div className="flex items-center justify-between gap-6 py-3.5">
                <dt className="text-muted">Student</dt>
                <dd className="font-medium text-ink">John Doe</dd>
              </div>
              <div className="flex items-center justify-between gap-6 py-3.5">
                <dt className="text-muted">Matric No</dt>
                <dd className="font-medium text-ink">2023/123456</dd>
              </div>
              <div className="flex items-center justify-between gap-6 py-3.5">
                <dt className="text-muted">Academic Session</dt>
                <dd className="font-medium text-ink">{sessionName ?? siteConfig.session}</dd>
              </div>
              <div className="flex items-center justify-between gap-6 py-3.5">
                <dt className="text-muted">Amount</dt>
                <dd className="text-2xl font-semibold tracking-tight text-ink">
                  {amountLabel ?? "Set by level"}
                </dd>
              </div>
            </dl>

            <div className="mt-6">
              <p className="text-sm text-muted">Payment method</p>
              <div
                className="mt-2.5 grid grid-cols-3 gap-2"
                role="presentation"
              >
                {paymentMethods.map((method, i) => (
                  <div
                    key={method.id}
                    className={`flex h-11 items-center justify-center rounded-xl text-[13px] font-medium ${
                      i === 0
                        ? "bg-ink text-white"
                        : "border border-line bg-white text-muted"
                    }`}
                  >
                    {method.label}
                  </div>
                ))}
              </div>
            </div>

            <PayDuesButton size="lg" className="mt-7 w-full">
              Continue to payment
            </PayDuesButton>
            <p className="mt-3.5 text-center text-xs leading-relaxed text-muted">
              Preview of the payment experience — you&apos;ll complete your
              payment on the secure payment page.
            </p>
          </div>
        </Reveal>
      </div>
    </section>
  );
}
