import { config } from '../config.js';

/* Scaffolding only. Renders nothing until PARTNER_LOGOS is filled in with
   logos you actually have permission to display, so no placeholder or
   borrowed brand can ship by accident. */
export default function LogoStrip() {
  const logos = config.partnerLogos;
  if (!logos.length) return null;

  return (
    <section className="logos" aria-label={config.partnerLogosTitle}>
      <div className="wrap">
        <p className="logos__title">{config.partnerLogosTitle}</p>
        <div className="logos__row">
          {logos.map((logo) =>
            logo.href ? (
              <a key={logo.name} href={logo.href} target="_blank" rel="noopener noreferrer">
                <img src={logo.src} alt={logo.name} loading="lazy" decoding="async" height="30" />
              </a>
            ) : (
              <img key={logo.name} src={logo.src} alt={logo.name} loading="lazy" decoding="async" height="30" />
            )
          )}
        </div>
      </div>
    </section>
  );
}
