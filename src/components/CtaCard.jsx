import { PayButton } from '../payments.jsx';

/* The two handoff moments: mid-page and closing. Rounded cards sitting on the
   light page rather than full-bleed bands, matching the reference's language. */
export default function CtaCard({ id, tone = 'blue', title, lede, note }) {
  return (
    <section className="section" aria-labelledby={id}>
      <div className="wrap">
        <div className={`cta cta--${tone} on-${tone}`}>
          <h2 className="cta__title" id={id}>{title}</h2>
          <p className="cta__lede">{lede}</p>
          <PayButton size="lg" arrow />
          <p className="cta__note">{note}</p>
        </div>
      </div>
    </section>
  );
}
