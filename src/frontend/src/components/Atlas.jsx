import { useEffect, useState } from 'react';

/**
 * The instrument-centric view: pivots the whole corpus by instrument class
 * instead of by facility, so the question becomes "which capabilities are
 * disappearing?" rather than "which lab is worst?".
 */
export default function Atlas({ onBack, onOpen }) {
  const [atlas, setAtlas] = useState(null);
  const [error, setError] = useState('');
  const [pick, setPick] = useState(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        let r = await fetch('/api/atlas');
        if (!r.ok) throw new Error();
        if (alive) setAtlas(await r.json());
      } catch {
        try {
          const r = await fetch('/data/atlas.json');
          if (!r.ok) throw new Error('missing');
          if (alive) setAtlas(await r.json());
        } catch { if (alive) setError('Atlas data is not built yet.'); }
      }
    })();
    return () => { alive = false; };
  }, []);

  useEffect(() => { window.scrollTo({ top: 0 }); }, []);

  const lost = atlas?.classes.filter((c) => c.removed > 0) || [];
  const max = lost.length ? lost[0].removed : 1;
  const selected = pick ? atlas.classes.find((c) => c.key === pick) : lost[0];

  return (
    <div className="atlas">
      <div className="det-topbar">
        <button className="det-back" data-cursor type="button" onClick={onBack}><span className="ar">←</span> All facilities</button>
      </div>

      <div className="atlas-head">
        <div className="det-kicker">Instrument atlas</div>
        <h1 className="atlas-h">Which instruments are disappearing?</h1>
        {atlas && (
          <p className="atlas-lead">
            Pivoted by instrument instead of facility. Across <b>{atlas.totals.facilities}</b> monitored
            facilities documenting <b>{atlas.totals.instruments.toLocaleString()}</b> instruments,
            {' '}<b>{atlas.totals.removed}</b> have vanished from the record — and the losses are not evenly spread.
          </p>
        )}
      </div>

      {error && <div className="det-error">{error}</div>}
      {!atlas && !error && <div className="det-loading"><span className="spin" /> Building the atlas…</div>}

      {atlas && (
        <>
          <div className="atlas-grid">
            <section className="atlas-card">
              <div className="atlas-card-h">
                <h2>Losses by instrument class</h2>
                <span className="mono">REMOVALS</span>
              </div>
              <div className="atlas-bars">
                {lost.map((c) => (
                  <button key={c.key} type="button" data-cursor
                    className={`abar ${selected?.key === c.key ? 'on' : ''}`} onClick={() => setPick(c.key)}>
                    <span className="abar-l">{c.label}</span>
                    <span className="abar-track">
                      <span className="abar-fill" style={{
                        width: `${Math.round((c.removed / max) * 100)}%`,
                        background: c.removed >= max * 0.75 ? 'linear-gradient(90deg,var(--crit),#FF8FB1)'
                          : c.removed >= max * 0.45 ? 'linear-gradient(90deg,var(--warn),#F0B23C)'
                          : 'linear-gradient(90deg,var(--g2),var(--g1))',
                      }} />
                    </span>
                    <span className="abar-n mono">{c.removed}</span>
                  </button>
                ))}
              </div>
              <p className="atlas-note">
                <b>{lost[0]?.label}</b> leads the losses — {lost[0]?.removed} removals across {lost[0]?.facilities} facilities.
                Click any class to see exactly where it vanished.
              </p>
            </section>

            {selected && (
              <section className="atlas-drill">
                <div className="mono adr-k">Drill-down</div>
                <h2 className="adr-h">{selected.label}</h2>
                <div className="adr-tiles">
                  <div><b className="mono">{selected.removed}</b><span>Removals</span></div>
                  <div><b className="mono">{selected.facilities}</b><span>Facilities</span></div>
                  <div><b className="mono">{selected.present}</b><span>Still documented</span></div>
                </div>
                <div className="mono adr-k" style={{ marginTop: 20 }}>Where it vanished</div>
                <div className="adr-list">
                  {selected.where.slice(0, 8).map((w, i) => (
                    <button key={i} type="button" data-cursor className="adr-row" onClick={() => onOpen({ id: w.id })}>
                      <span className="adr-dot" />
                      <span className="adr-lab">{w.name}</span>
                      <span className="adr-yr mono">{w.lastSeen || '—'}</span>
                    </button>
                  ))}
                  {selected.where.length > 8 && <div className="adr-more mono">+ {selected.where.length - 8} more</div>}
                </div>
              </section>
            )}
          </div>

          <section className="atlas-card" style={{ marginTop: 20 }}>
            <div className="atlas-card-h"><h2>Loss concentration by region</h2></div>
            <div className="atlas-regions">
              {atlas.regions.filter((r) => r.facilities >= 2).map((r) => (
                <div className="areg" key={r.name}
                  style={{ background: r.rate >= 30 ? 'var(--crit-bg)' : r.rate >= 15 ? 'var(--warn-bg)' : 'var(--good-bg)' }}>
                  <div className="areg-n">{r.name}</div>
                  <div className="areg-r mono" style={{ color: r.rate >= 30 ? 'var(--crit)' : r.rate >= 15 ? 'var(--warn)' : 'var(--good)' }}>{r.rate}%</div>
                  <div className="areg-d">{r.losing} of {r.facilities} facilities losing</div>
                </div>
              ))}
            </div>
          </section>
        </>
      )}
    </div>
  );
}
