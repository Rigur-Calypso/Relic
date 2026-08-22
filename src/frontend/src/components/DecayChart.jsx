/**
 * Knowledge-decay curve.
 *
 * The line is the SIZE of the documented inventory at each archived snapshot —
 * a shrinking line is capability disappearing from the record. Each point is
 * coloured by how much of that era's inventory still survives on the live page
 * today, which is the number that actually measures loss. (Retention is
 * measured against today, so it would trivially reach 100% at "now" — plotting
 * it as the line would read as improvement, which is why it colours the points
 * and fills the cards instead.)
 */
const W = 720, H = 210, PADL = 42, PADR = 16, PADT = 20, PADB = 36;
const colorFor = (pct) => pct == null ? 'var(--ink-3)' : pct >= 80 ? 'var(--good)' : pct >= 45 ? 'var(--warn)' : 'var(--crit)';

export default function DecayChart({ points }) {
  if (!points || points.length < 2) return null;

  const n = points.length;
  const plotW = W - PADL - PADR, plotH = H - PADT - PADB;
  const maxDoc = Math.max(...points.map((p) => p.documented || 0), 1);
  const top = Math.ceil(maxDoc * 1.15);

  const x = (i) => PADL + (i / (n - 1)) * plotW;
  const y = (d) => PADT + plotH - (Math.max(0, d) / top) * plotH;

  const line = points.map((p, i) => `${x(i)},${y(p.documented)}`).join(' ');
  const area = `${PADL},${PADT + plotH} ${line} ${x(n - 1)},${PADT + plotH}`;

  const first = points[0], last = points[n - 1];
  const delta = (last.documented || 0) - (first.documented || 0);
  const ticks = [0, Math.round(top / 2), top];

  return (
    <section className="det-block decay">
      <h2 className="det-h">
        Knowledge decay over time
        <span className="det-h-c">{n} snapshots</span>
      </h2>
      <p className="decay-lead">
        Instruments documented at each archived snapshot
        {delta !== 0 && (
          <> — <b style={{ color: delta < 0 ? 'var(--crit)' : 'var(--good)' }}>
            {delta < 0 ? `down ${Math.abs(delta)}` : `up ${delta}`}
          </b> since {first.year}</>
        )}. Point colour shows how much of that era’s inventory still survives today.
      </p>

      <div className="decay-wrap">
        <svg viewBox={`0 0 ${W} ${H}`} className="decay-svg" role="img"
          aria-label={`Documented instruments from ${first.documented} in ${first.year} to ${last.documented} today`}>
          <defs>
            <linearGradient id="decayFade" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--g2)" stopOpacity="0.20" />
              <stop offset="100%" stopColor="var(--g2)" stopOpacity="0" />
            </linearGradient>
          </defs>

          {ticks.map((g) => (
            <g key={g}>
              <line x1={PADL} y1={y(g)} x2={W - PADR} y2={y(g)} stroke="rgba(21,23,43,.07)" strokeWidth="1" />
              <text x={PADL - 8} y={y(g) + 3.5} textAnchor="end" className="decay-ax">{g}</text>
            </g>
          ))}

          <polygon points={area} fill="url(#decayFade)" />
          <polyline points={line} fill="none" stroke="var(--g2)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />

          {points.map((p, i) => (
            <g key={i}>
              <circle cx={x(i)} cy={y(p.documented)} r={i === n - 1 ? 6 : 4.8}
                fill={colorFor(p.retentionPct)} stroke="#fff" strokeWidth="2" />
              <text x={x(i)} y={y(p.documented) - 12} textAnchor="middle" className="decay-val mono">{p.documented}</text>
              <text x={x(i)} y={H - 12} textAnchor="middle" className="decay-ax">{p.year}</text>
              <title>{`${p.year}: ${p.documented} documented · ${p.retained} still present today (${p.retentionPct}%)`}</title>
            </g>
          ))}
        </svg>
      </div>

      <div className="decay-pts">
        {points.map((p, i) => (
          <div className="decay-pt" key={i}>
            <div className="decay-yr mono">{p.year}</div>
            <div className="decay-pct mono" style={{ color: colorFor(p.retentionPct) }}>{p.retentionPct}%</div>
            <div className="decay-cap">
              {p.year === 'now' ? `${p.documented} documented today` : `${p.retained} of ${p.documented} survive`}
            </div>
            {p.snapshotUrl && p.year !== 'now' && (
              <a className="decay-link mono" href={p.snapshotUrl} target="_blank" rel="noopener noreferrer" data-cursor>archive ↗</a>
            )}
          </div>
        ))}
      </div>
    </section>
  );
}
