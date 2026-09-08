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

export default function Home() {
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
        <Hero />
        <TrustStrip />
        <HowItWorks />
        <PaymentPreview />
        <PaymentMethods />
        <SecuritySection />
        <FAQ />
        <FinalCTA />
      </main>
      <Footer />
    </MotionProvider>
  );
}
