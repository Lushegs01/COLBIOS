import Reveal from './Reveal.jsx';

const STEPS = [
  { n: '01', title: 'Start here', text: 'Visit the COLBIOS website and press Pay Now. That is everything this page asks of you.' },
  { n: '02', title: 'Complete your payment', text: 'You are taken to the secure COLBIOS payment platform to enter your details and complete payment.' },
  { n: '03', title: 'Get confirmation', text: 'Once your payment is processed, the payment platform provides your payment confirmation and receipt.' }
];

export default function HowItWorks() {
  return (
    <section className="section" id="how" aria-labelledby="how-title">
      <div className="wrap">
        <div className="split-head">
          <h2 className="section__title" id="how-title">How COLBIOS works</h2>
          <p className="section__lede">
            Three steps, and only one of them happens on this website.
          </p>
        </div>

        <ol className="steps">
          {STEPS.map((s, i) => (
            <Reveal as="li" className="step" key={s.n} delay={i * 80}>
              <span className="step__num mono" aria-hidden="true">{s.n}</span>
              <h3 className="step__title">{s.title}</h3>
              <p className="step__text">{s.text}</p>
            </Reveal>
          ))}
        </ol>
      </div>
    </section>
  );
}
