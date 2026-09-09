import type { Metadata } from "next";

import PaymentForm from "@/components/pay/PaymentForm";
import { Card, Notice, PageTitle, PayShell } from "@/components/ui/Surfaces";
import { getPaymentConfiguration } from "@/lib/payments/config";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Pay COLBIOS Dues",
  description:
    "Pay your College of Biosciences dues securely. Enter your details, review the amount, and pay with Paystack.",
};

/**
 * The student payment page.
 *
 * Rendered on the server with the live configuration, so the form always shows
 * the departments and levels that are actually open — nothing about the fee
 * structure is hard-coded in the UI.
 */
export default async function PayPage() {
  const config = await getPaymentConfiguration();

  if (!config.session) {
    return (
      <PayShell>
        <PageTitle
          eyebrow="COLBIOS dues"
          title="Dues payment is not open yet"
          description="No academic session is currently open for payment."
        />
        <Card>
          <Notice tone="warning" title="Nothing to pay right now">
            The College of Biosciences has not opened a session for dues payment. Please check back
            later, or contact the college office if you believe this is a mistake.
          </Notice>
        </Card>
      </PayShell>
    );
  }

  if (config.levels.length === 0 || config.departments.length === 0) {
    return (
      <PayShell>
        <PageTitle
          eyebrow="COLBIOS dues"
          title="Dues are not configured yet"
          description={`Payment for the ${config.session.name} session is not ready.`}
        />
        <Card>
          <Notice tone="warning" title="Setup is incomplete">
            {config.levels.length === 0
              ? "No dues amounts have been set for this session yet."
              : "No departments have been set up yet."}{" "}
            Please check back later or contact the college office.
          </Notice>
        </Card>
      </PayShell>
    );
  }

  return (
    <PayShell>
      <PageTitle
        eyebrow={`Academic session ${config.session.name}`}
        title="Pay your COLBIOS dues"
        description="Enter your details below. We'll show you the exact amount for your level before you pay."
      />

      <Card>
        <PaymentForm
          departments={config.departments}
          levels={config.levels}
          sessionName={config.session.name}
        />
      </Card>

      <p className="mt-6 text-center text-[12.5px] leading-relaxed text-muted">
        Already paid?{" "}
        <span className="font-medium text-pine-700">
          Open the receipt link from your confirmation email to view or verify it.
        </span>
      </p>
    </PayShell>
  );
}
