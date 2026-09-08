import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { config } from './config.js';
import { Mark, Arrow } from './components/Icons.jsx';

/* Every Pay Now on the site goes through here, so the destination has exactly
   one source of truth and the handoff behaves identically everywhere. */
const PaymentContext = createContext(null);

const prefersReduced = () =>
  typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

export function PaymentProvider({ children }) {
  const [state, setState] = useState(null); // null | 'going' | 'blocked'
  const restoreFocus = useRef(null);
  const configured = Boolean(config.paymentPlatformUrl);

  const start = useCallback((event) => {
    if (!configured) {
      event.preventDefault();
      restoreFocus.current = document.activeElement;
      setState('blocked');
      return;
    }
    // A new tab has to open inside the user's own gesture, or popup blockers
    // eat it — so that path skips the interstitial entirely.
    if (config.openInNewTab) return;
    // Respect an explicit open-in-new-tab intent.
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || event.button !== 0) return;

    event.preventDefault();
    restoreFocus.current = document.activeElement;
    setState('going');
    const delay = prefersReduced() ? 0 : config.redirectDelayMs;
    window.setTimeout(() => { window.location.href = config.paymentPlatformUrl; }, delay);
  }, [configured]);

  const dismiss = useCallback(() => {
    setState(null);
    if (restoreFocus.current && restoreFocus.current.focus) restoreFocus.current.focus();
  }, []);

  return (
    <PaymentContext.Provider value={{ configured, href: config.paymentPlatformUrl || '#', start }}>
      {children}
      {state && <Handoff state={state} onDismiss={dismiss} />}
    </PaymentContext.Provider>
  );
}

export const usePayment = () => useContext(PaymentContext);

/* The one Pay Now control, used in the header, hero, preview card, both CTA
   cards and the footer. */
export function PayButton({ children = 'Pay Now', arrow = false, className = '', size = '', ...rest }) {
  const { configured, href, start } = usePayment();
  return (
    <a
      href={href}
      onClick={start}
      data-pay
      {...(configured ? {} : { 'data-unconfigured': 'true' })}
      {...(configured && config.openInNewTab ? { target: '_blank', rel: 'noopener' } : {})}
      className={`btn btn--pay${size ? ' btn--' + size : ''}${className ? ' ' + className : ''}`}
      {...rest}
    >
      {children}
      {arrow && <Arrow />}
    </a>
  );
}

function Handoff({ state, onDismiss }) {
  const boxRef = useRef(null);
  const closeRef = useRef(null);
  const blocked = state === 'blocked';

  useEffect(() => {
    (blocked ? closeRef : boxRef).current?.focus();
    if (!blocked) return;
    const onKey = (e) => { if (e.key === 'Escape') onDismiss(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [blocked, onDismiss]);

  return (
    <div className="handoff">
      <div className="handoff__box" role="status" aria-live="polite" tabIndex={-1} ref={boxRef}>
        <span className="handoff__mark"><Mark size={30} /></span>
        {blocked ? (
          <>
            <p className="handoff__title">Payment platform not configured</p>
            <p className="handoff__note">
              This site has no payment platform address set yet, so there is nowhere to send you.
              Whoever deploys the site sets <code>PAYMENT_PLATFORM_URL</code> in{' '}
              <code>public/colbios-config.js</code>.
            </p>
            <button type="button" className="btn btn--quiet btn--sm" onClick={onDismiss} ref={closeRef}>
              Close
            </button>
          </>
        ) : (
          <>
            <p className="handoff__title">Opening COLBIOS payment platform…</p>
            <p className="handoff__note">You are being redirected to complete your payment.</p>
            <span
              className="handoff__bar"
              style={{ '--ms': `${config.redirectDelayMs}ms` }}
              aria-hidden="true"
            />
          </>
        )}
      </div>
    </div>
  );
}
