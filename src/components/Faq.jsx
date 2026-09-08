import { useId, useState } from 'react';
import { config, hasSupportContact } from '../config.js';

function supportAnswer() {
  const base =
    'Support is provided through the COLBIOS payment platform. Use the help or support option ' +
    'there, so your enquiry reaches the team that can see your payment.';
  if (!hasSupportContact) return base;
  const bits = [];
  if (config.supportEmail) bits.push(`by email at ${config.supportEmail}`);
  if (config.supportPhone) bits.push(`on ${config.supportPhone}`);
  const hours = config.supportHours ? ` (${config.supportHours})` : '';
  return `${base} You can also reach COLBIOS support directly ${bits.join(', ')}${hours}.`;
}

const ITEMS = () => [
  {
    q: 'What is COLBIOS?',
    a: `COLBIOS is a digital payment platform designed to make student dues payment simpler, more accessible and more convenient for the ${config.institutionShort} community. This website explains how it works and gives you access to it.`
  },
  {
    q: 'Where do I pay my dues?',
    a: 'On the COLBIOS payment platform. Use the Pay Now button anywhere on this page and you will be taken there to complete your payment.'
  },
  {
    q: 'Is this where I enter my payment details?',
    a: 'No. This website is the COLBIOS information and access page. It does not collect your matriculation number, card details or any payment information. Those are entered on the payment platform after you press Pay Now.'
  },
  {
    q: 'Can I access COLBIOS from my phone?',
    a: 'This website works on phones, tablets and computers. Pay Now opens the payment platform in the same browser, so you can start here and continue on the same device.'
  },
  {
    q: 'What happens after I pay?',
    a: 'The payment platform processes your payment and provides your confirmation or receipt. Keep that confirmation. This website does not store any record of your payment and cannot look one up.'
  },
  {
    q: 'I was debited but did not receive confirmation. What should I do?',
    a: 'Do not pay a second time. Check your payment status on the COLBIOS payment platform first, as confirmation can take a short while to appear. If it still is not showing, use the support channel on the payment platform and quote the transaction details from your bank.'
  },
  { q: 'Who do I contact for help?', a: supportAnswer() }
];

function Item({ q, a, index }) {
  const [open, setOpen] = useState(false);
  const uid = useId();
  const btnId = `faq-q-${index}-${uid}`;
  const panelId = `faq-a-${index}-${uid}`;

  return (
    <div className={`faq__item${open ? ' open' : ''}`}>
      <h3>
        <button
          type="button"
          className="faq__q"
          id={btnId}
          aria-expanded={open}
          aria-controls={panelId}
          onClick={() => setOpen((v) => !v)}
        >
          {q}
          <span className="faq__sign" aria-hidden="true" />
        </button>
      </h3>
      {/* Stays in the DOM so the open/close transition can run; CSS flips
          visibility once collapsed, which also takes it out of the
          accessibility tree. */}
      <div className="faq__a" id={panelId} role="region" aria-labelledby={btnId}>
        <div><p>{a}</p></div>
      </div>
    </div>
  );
}

export default function Faq() {
  return (
    <section className="section" id="faq" aria-labelledby="faq-title">
      <div className="wrap">
        <div className="split-head">
          <h2 className="section__title" id="faq-title">Help and common questions</h2>
          <p className="section__lede">
            If something here does not answer your question, support is available through
            the payment platform.
          </p>
        </div>
        <div className="faq">
          {ITEMS().map((item, i) => <Item key={item.q} index={i} {...item} />)}
        </div>
      </div>
    </section>
  );
}
