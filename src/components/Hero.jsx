import { config } from '../config.js';
import { PayButton, usePayment } from '../payments.jsx';
import Reveal from './Reveal.jsx';
import { Mark, Shield, Check, Cap } from './Icons.jsx';

export default function Hero() {
  const { href, start } = usePayment();

  return (
    <section className="hero" aria-labelledby="hero-title">
      <div className="wrap hero__grid">
        <div>
          <Reveal as="p" className="pill">
            <span className="pill__dot" aria-hidden="true" />
            {config.institutionShort} student payments
          </Reveal>

          <Reveal as="h1" className="hero__title" delay={70} id="hero-title">
            Your COLBIOS dues,<br />made simple.
          </Reveal>

          <Reveal as="p" className="hero__lede" delay={140}>
            Access the official COLBIOS payment platform to securely complete your student
            dues payment — from your phone, tablet or computer.
          </Reveal>

          <Reveal className="hero__actions" delay={210}>
            <PayButton size="lg" arrow />
            <a className="btn btn--quiet btn--lg" href="#how">How It Works</a>
          </Reveal>

          <Reveal as="p" className="note" delay={280}>
            <Shield size={15} />
            You will be redirected to the COLBIOS payment platform to complete your payment.
          </Reveal>

          <Reveal as="ul" className="assure" delay={350}>
            <li><Shield /> Secure payments</li>
            <li><Check /> Digital confirmation</li>
            <li><Cap /> Student-focused</li>
          </Reveal>
        </div>

        <Reveal as="figure" className="visual" delay={160}>
          {/* The frame is the positioning context, so the confirmation chip hangs
              off the card rather than off the whole figure (caption included). */}
          <div className="visual__frame">
          {/* A still preview of the separate platform — not a form. It is wrapped
              in the same Pay Now link so pressing it does what it looks like it does. */}
          <a
            className="preview-link"
            href={href}
            onClick={start}
            data-pay
            aria-label="Pay Now: continue to the COLBIOS payment platform"
          >
            <span className="preview" aria-hidden="true">
              <span className="preview__head">
                <span className="preview__brand"><Mark size={18} /> COLBIOS</span>
                <span className="preview__tag">Payment platform</span>
              </span>
              <span className="preview__body">
                <span className="preview__label">Student dues</span>
                <span className="preview__row">
                  <span className="preview__key">Payment status</span>
                  <span className="preview__status"><Check size={14} /> Verified</span>
                </span>
                <span className="preview__row">
                  <span className="preview__key">Reference</span>
                  <span className="preview__val mono">COLBIOS&#8209;XXXX&#8209;XXXX</span>
                </span>
                <span className="preview__row preview__row--last">
                  <span className="preview__key">Receipt</span>
                  <span className="preview__val">Available after payment</span>
                </span>
                <span className="preview__cta">Continue</span>
              </span>
            </span>
          </a>

          <span className="chip" aria-hidden="true">
            <span className="chip__icon"><Check size={17} /></span>
            <span>
              <span className="chip__t">Payment confirmed</span>
              <span className="chip__s">Receipt issued on the platform</span>
            </span>
          </span>
          </div>

          <figcaption className="visual__cap">
            A preview of the COLBIOS payment platform. Your details are entered there,
            not on this page.
          </figcaption>
        </Reveal>
      </div>
    </section>
  );
}
