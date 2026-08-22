import { countryOf } from '../geo.js';

const bandColor = (v) => v == null ? 'var(--ink-3)' : v >= 90 ? 'var(--good)' : v >= 60 ? 'var(--warn)' : 'var(--crit)';

/**
 * One facility as a dense ranked row — the worst-first view. Carries the same
 * data as a card but trades the grid's browsability for scannable ranking:
 * position, what was lost, how much of the inventory that represents, score.
 */
export default function LabRow({ lab, rank, onOpen }) {
  const v = lab.vitalityScore;
  const color = bandColor(v);
  const removed = lab.removed || [];
  const total = lab.trackingCount || 0;
  // Share of the *historical* inventory that is gone: removed / (removed + still here).
  const pct = removed.length + total ? Math.round((removed.length / (removed.length + total)) * 100) : 0;
  const lost = removed.map((r) => r.name).filter(Boolean).join(', ');

  return (
    <div className="lrow" data-cursor role="button" tabIndex={0}
      onClick={() => onOpen(lab)}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onOpen(lab); } }}>

      <div className="lrow-rank mono">{String(rank).padStart(2, '0')}</div>

      <div className="lrow-id">
        <div className="lrow-name">
          {lab.name}
          {countryOf(lab.url) && <span className="lrow-cc mono">{countryOf(lab.url)}</span>}
        </div>
        <div className="lrow-lost mono" title={lost}>
          {removed.length
            ? <><span className="m">−</span><span className="t">{lost}</span></>
            : <span className="none">no instruments removed</span>}
        </div>
      </div>

      <div className="lrow-share">
        <div className="lrow-track"><div className="lrow-fill" style={{ width: `${pct}%`, background: color }} /></div>
        <div className="lrow-cap">
          {removed.length
            ? <><b className="mono">{removed.length}</b> of {removed.length + total} instruments gone</>
            : <><b className="mono">{total}</b> instruments preserved</>}
        </div>
      </div>

      <div className="lrow-score" style={v == null ? undefined : { background: color, boxShadow: `0 10px 20px -8px ${color}` }}>
        {v == null ? '—' : Math.round(v)}
      </div>
    </div>
  );
}
