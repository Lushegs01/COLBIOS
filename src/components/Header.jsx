import { useEffect, useState } from 'react';
import { config } from '../config.js';
import { PayButton } from '../payments.jsx';
import { Mark } from './Icons.jsx';

const LINKS = [
  { href: '#top', label: 'Home' },
  { href: '#how', label: 'How It Works' },
  { href: '#about', label: 'About COLBIOS' },
  { href: '#faq', label: 'Help' }
];

export default function Header() {
  const [stuck, setStuck] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    let ticking = false;
    const onScroll = () => {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(() => { ticking = false; setStuck(window.scrollY > 8); });
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  return (
    <header className={`head${stuck ? ' stuck' : ''}`}>
      <div className="head__inner">
        <a className="brand" href="#top" aria-label="COLBIOS, back to top">
          <span className="brand__mark"><Mark /></span>
          <span className="brand__text">
            <span className="brand__name">COLBIOS</span>
            <span className="brand__sub">{config.institutionShort} student payments</span>
          </span>
        </a>

        <nav className="nav" aria-label="Primary">
          {LINKS.map((l) => <a key={l.href} href={l.href}>{l.label}</a>)}
        </nav>

        <div className="head__actions">
          <PayButton size="sm" />
          <button
            type="button"
            className="burger"
            aria-expanded={open}
            aria-controls="mobile-nav"
            onClick={() => setOpen((v) => !v)}
          >
            <span aria-hidden="true"><i /><i /><i /></span>
            <span className="sr">{open ? 'Close menu' : 'Open menu'}</span>
          </button>
        </div>
      </div>

      {open && (
        <nav className="mobnav" id="mobile-nav" aria-label="Primary, mobile">
          {LINKS.map((l) => (
            <a key={l.href} href={l.href} onClick={() => setOpen(false)}>{l.label}</a>
          ))}
        </nav>
      )}
    </header>
  );
}
