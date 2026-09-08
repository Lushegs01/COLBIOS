import { useEffect } from 'react';
import { config } from './config.js';
import { PaymentProvider } from './payments.jsx';
import Header from './components/Header.jsx';
import Hero from './components/Hero.jsx';
import LogoStrip from './components/LogoStrip.jsx';
import Benefits from './components/Benefits.jsx';
import Stats from './components/Stats.jsx';
import HowItWorks from './components/HowItWorks.jsx';
import CtaCard from './components/CtaCard.jsx';
import About from './components/About.jsx';
import Faq from './components/Faq.jsx';
import Footer from './components/Footer.jsx';

export default function App() {
  /* Keep canonical and og:url in step with the deployed address. Both are also
     in index.html for crawlers that do not run JavaScript. */
  useEffect(() => {
    if (!config.siteUrl) return;
    document.querySelector('link[rel="canonical"]')?.setAttribute('href', config.siteUrl);
    document.querySelector('meta[property="og:url"]')?.setAttribute('content', config.siteUrl);
  }, []);

  return (
    <PaymentProvider>
      <a className="skip" href="#main">Skip to content</a>
      <Header />
      <main id="main">
        <Hero />
        <LogoStrip />
        <Benefits />
        <Stats />
        <HowItWorks />
        <CtaCard
          id="cta-mid"
          tone="blue"
          title="Ready to pay your dues?"
          lede="Continue to the COLBIOS payment platform."
          note="You will be redirected to the payment platform to complete your transaction."
        />
        <About />
        <Faq />
        <CtaCard
          id="cta-final"
          tone="dark"
          title="Pay your COLBIOS dues securely."
          lede={`A simple, secure and convenient way for ${config.institutionShort} students to complete their required payments.`}
          note="You will be redirected to the COLBIOS payment platform to complete your payment."
        />
      </main>
      <Footer />
    </PaymentProvider>
  );
}
