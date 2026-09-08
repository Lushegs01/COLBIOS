/**
 * Central site configuration.
 * Every value that a maintainer might need to change lives here —
 * update once and it propagates across the whole landing page.
 */
export const siteConfig = {
  brandName: "COLBIOS",
  institution: "College of Biosciences",
  university: "Federal University of Agriculture, Abeokuta",
  session: "2026/2027",
  duesAmount: 5_000,
  paymentUrl: "https://your-payment-platform.com",
  supportEmail: "support@example.com",
} as const;

/** Format an amount as Naira, e.g. 5000 -> "₦5,000" */
export function formatNaira(amount: number): string {
  return `₦${amount.toLocaleString("en-NG")}`;
}

/** Payment methods shown across the page. Keep in sync with what the
 *  actual payment platform supports before going live. */
export const paymentMethods = [
  {
    id: "card",
    label: "Card",
    description: "Pay securely with your debit card in a few taps.",
  },
  {
    id: "transfer",
    label: "Bank Transfer",
    description: "Transfer directly from your bank account.",
  },
  {
    id: "ussd",
    label: "USSD",
    description: "Pay from your phone without internet data.",
  },
] as const;

export const howItWorksSteps = [
  {
    number: "01",
    title: "Enter your details",
    description:
      "Provide your matric number and verify your student information.",
  },
  {
    number: "02",
    title: "Make payment",
    description:
      "Choose your preferred payment method and complete your payment securely.",
  },
  {
    number: "03",
    title: "Get confirmation",
    description:
      "Receive confirmation and access your digital payment receipt.",
  },
] as const;

export const faqs = [
  {
    question: "Who can use COLBIOS Dues?",
    answer:
      "Students of the College of Biosciences, Federal University of Agriculture, Abeokuta, who need to pay their college dues for the 2026/2027 academic session.",
  },
  {
    question: "How do I pay my dues?",
    answer:
      "Tap “Pay dues now”, enter your matric number to verify your details, choose a payment method, and complete your payment. You’ll see a confirmation as soon as it goes through.",
  },
  {
    question: "What payment methods are available?",
    answer:
      "Card, bank transfer, and USSD are shown on this page. The methods you can actually use are the ones offered on the payment page at checkout.",
  },
  {
    question: "How do I know my payment was successful?",
    answer:
      "You’ll see an on-screen confirmation immediately after paying, and your dues status updates once the payment is processed.",
  },
  {
    question: "Can I get a receipt?",
    answer:
      "Yes. A digital receipt is generated for every successful payment, which you can view and keep for your records.",
  },
  {
    question: "What should I do if I paid but my status has not updated?",
    answer:
      "Give it a few minutes and refresh. If your status still hasn’t updated, contact us with your payment receipt and we’ll help sort it out.",
  },
] as const;
