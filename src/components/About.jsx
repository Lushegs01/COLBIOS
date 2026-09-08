import { config } from '../config.js';
import Reveal from './Reveal.jsx';
import { Check, Cross, LongArrow } from './Icons.jsx';

export default function About() {
  return (
    <section className="section" id="about" aria-labelledby="about-title">
      <div className="wrap">
        <div className="split-head">
          <h2 className="section__title" id="about-title">What is COLBIOS?</h2>
          <p className="section__lede section__lede--lead">
            COLBIOS is a digital payment platform designed to make student dues payment
            simpler, more accessible and more convenient for the {config.institutionShort} community.
          </p>
        </div>

        <div className="split">
          <Reveal as="article" className="split__card">
            <p className="split__kicker">This website</p>
            <h3 className="split__title">Information and access</h3>
            <ul className="split__list">
              <li>Explains what COLBIOS is and who it is for</li>
              <li>Shows how the payment process works</li>
              <li>Answers common questions before you start</li>
              <li>Gives you the route into the payment platform</li>
            </ul>
            <p className="split__foot split__foot--no">
              <Cross /> No payment details are entered here
            </p>
          </Reveal>

          <span className="split__arrow" aria-hidden="true"><LongArrow /></span>

          <Reveal as="article" className="split__card split__card--platform" delay={90}>
            <p className="split__kicker">The COLBIOS payment platform</p>
            <h3 className="split__title">Payment and confirmation</h3>
            <ul className="split__list">
              <li>Student identification</li>
              <li>Payment processing</li>
              <li>Transaction confirmation</li>
              <li>Your receipt</li>
            </ul>
            <p className="split__foot split__foot--yes">
              <Check size={16} /> This is where you pay
            </p>
          </Reveal>
        </div>

        <p className="split__cap">
          Pressing <strong>Pay Now</strong> anywhere on this site takes you from the left side
          to the right side. That is the only thing this website does with your payment.
        </p>
      </div>
    </section>
  );
}
