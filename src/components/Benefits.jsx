import Reveal from './Reveal.jsx';
import { Shield, Fast, Phone, Receipt } from './Icons.jsx';

const ITEMS = [
  { Icon: Shield,  title: 'Secure',      text: 'Your payment is processed through a secure payment environment.' },
  { Icon: Fast,    title: 'Simple',      text: 'Access the payment platform and complete your dues payment without unnecessary steps.' },
  { Icon: Phone,   title: 'Convenient',  text: 'Pay online from your phone, tablet or computer.' },
  { Icon: Receipt, title: 'Confirmable', text: 'Receive confirmation of completed payments through the payment platform.' }
];

export default function Benefits() {
  return (
    <section className="section" aria-labelledby="why-title">
      <div className="wrap">
        <div className="split-head">
          <h2 className="section__title" id="why-title">Why students use COLBIOS</h2>
          <p className="section__lede">
            One place to understand your dues payment, and one clear route to completing it.
            Everything here is about getting you to the payment platform with no confusion.
          </p>
        </div>

        <ul className="cards">
          {ITEMS.map(({ Icon, title, text }, i) => (
            <Reveal as="li" className="card" key={title} delay={i * 70}>
              <span className="card__icon"><Icon size={22} /></span>
              <h3 className="card__title">{title}</h3>
              <p className="card__text">{text}</p>
            </Reveal>
          ))}
        </ul>
      </div>
    </section>
  );
}
