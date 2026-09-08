/**
 * Landing-page copy and brand constants.
 *
 * Note what is deliberately *not* here any more: the dues amount and the
 * academic session. Those are configuration, they live in the database, and the
 * landing page reads them through lib/landing.ts — so the marketing page can
 * never quote a figure that checkout would not charge.
 */
export const siteConfig = {
  brandName: "COLBIOS",
  institution: "College of Biosciences",
  university: "Federal University of Agriculture, Abeokuta",
  /** Fallback only, for the rare render where no session is configured yet. */
  session: "the current",
  /** The payment application lives at /pay in this same deployment. */
  paymentUrl: "/pay",
  supportEmail: "support@example.com",
} as const;

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
      "Students of the College of Biosciences, Federal University of Agriculture, Abeokuta, who need to pay their college dues for the current academic session.",
  },
  {
    question: "How do I pay my dues?",
    answer:
      "Tap “Pay dues now”, enter your name, matric number, department and level, review the exact amount for your level, then pay with Paystack. You’ll see a confirmation as soon as the payment is verified.",
  },
  {
    question: "How much are my dues?",
    answer:
      "Dues are set by the College of Biosciences and depend on your level. Enter your details on the payment page and the exact amount for your level is shown before you pay anything.",
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
      "Yes. A receipt is issued for every verified payment. You can view it online, print it, or download it as a PDF, and anyone can scan the QR code on it to confirm the payment is genuine.",
  },
  {
    question: "What should I do if I paid but my status has not updated?",
    answer:
      "Give it a few minutes and refresh. If your status still hasn’t updated, contact us with your payment receipt and we’ll help sort it out.",
  },
] as const;
