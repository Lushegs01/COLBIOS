import FAQ from "@/components/FAQ";
import FinalCTA from "@/components/FinalCTA";
import Footer from "@/components/Footer";
import Hero from "@/components/Hero";
import HowItWorks from "@/components/HowItWorks";
import MotionProvider from "@/components/MotionProvider";
import Navbar from "@/components/Navbar";
import PaymentMethods from "@/components/PaymentMethods";
import PaymentPreview from "@/components/PaymentPreview";
import SecuritySection from "@/components/SecuritySection";
import TrustStrip from "@/components/TrustStrip";
import { getLandingConfig } from "@/lib/landing";

/**
 * The public landing page.
 *
 * It reads the same live configuration the payment flow uses, so it can never
 * advertise a session or an amount that checkout would not honour. Revalidated
 * every five minutes: configuration changes rarely, and students on slow
 * connections should get a cached page.
 */
export const revalidate = 300;

export default async function Home() {
  const config = await getLandingConfig();

  return (
    <MotionProvider>
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-[60] focus:rounded-full focus:bg-white focus:px-4 focus:py-2 focus:text-sm focus:font-medium focus:text-ink focus:shadow-lift"
      >
        Skip to content
      </a>
      <Navbar />
      <main id="main">
        <Hero sessionName={config.sessionName} amountLabel={config.amountLabel} />
        <TrustStrip />
        <HowItWorks />
        <PaymentPreview sessionName={config.sessionName} amountLabel={config.amountLabel} />
        <PaymentMethods />
        <SecuritySection />
        <FAQ />
        <FinalCTA sessionName={config.sessionName} />
      </main>
      <Footer />
    </MotionProvider>
  );
}
