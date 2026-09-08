import { config } from '../config.js';
import Reveal from './Reveal.jsx';

/* Scaffolding only. Renders nothing until STATS is filled with real,
   verifiable figures — there are no defaults, so nothing invented can ship. */
export default function Stats() {
  const stats = config.stats;
  if (!stats.length) return null;

  return (
    <section className="stats" aria-labelledby="stats-title">
      <div className="wrap">
        <h2 className="sr" id="stats-title">COLBIOS in numbers</h2>
        <ul className="stats__grid" style={{ '--stat-cols': Math.min(stats.length, 4) }}>
          {stats.map((s, i) => (
            <Reveal as="li" className="stat" key={s.label} delay={i * 70}>
              <span className="stat__value">{s.value}</span>
              <span className="stat__label">{s.label}</span>
              {s.note && <span className="stat__note">{s.note}</span>}
            </Reveal>
          ))}
        </ul>
      </div>
    </section>
  );
}
