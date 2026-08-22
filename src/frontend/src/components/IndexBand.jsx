import { useEffect, useState } from 'react';

/** Count-up used by the index headline. */
function Tick({ to, decimals = 0 }) {
  const [n, setN] = useState(0);
  useEffect(() => {
    let raf, t0; const dur = 1400;
    const step = (t) => {
      if (!t0) t0 = t;
      const k = Math.min(1, (t - t0) / dur);
      setN(to * (1 - Math.pow(1 - k, 3)));
      if (k < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    // rAF is paused in a hidden tab, which would freeze the number mid-count.
    // Snap to the real value once the animation window has passed.
    const settle = setTimeout(() => setN(to), dur + 150);
    return () => { cancelAnimationFrame(raf); clearTimeout(settle); };
  }, [to]);
  return <>{n.toFixed(decimals)}</>;
}

/**
 * The Global Knowledge-Loss Index: of the facilities that actually have an
 * archive baseline to compare against, what share have measurably lost
 * documented capability. Facilities with no baseline are excluded from the
 * ratio (they can't be judged) but still shown in the split bar.
 */
export default function IndexBand({ stats, onExplore }) {
  const { loss, intact, none, removed } = stats;
  const judged = loss + intact;
  const index = judged ? (loss / judged) * 100 : 0;

  return (
    <section className="idxband">
      <div className="idx-main">
        <div className="idx-k">Global knowledge-loss index</div>
        <div className="idx-n">
          <span className="mono"><Tick to={index} decimals={1} /></span>
          <span className="idx-u">%</span>
        </div>
        <p className="idx-d">
          Of the <b>{judged}</b> facilities with a verifiable archive baseline,
          {' '}<b>{loss}</b> have measurably lost documented capability.
        </p>

        <div className="idx-bar" role="img"
          aria-label={`${loss} losing, ${intact} intact, ${none} without a baseline`}>
          <span style={{ flex: loss || 0.001, background: 'var(--crit)' }} />
          <span style={{ flex: intact || 0.001, background: 'var(--good)' }} />
          <span style={{ flex: none || 0.001, background: 'rgba(255,255,255,.18)' }} />
        </div>
        <div className="idx-legend">
          <span><i style={{ background: 'var(--crit)' }} />{loss} losing</span>
          <span><i style={{ background: 'var(--good)' }} />{intact} intact</span>
          <span><i style={{ background: 'rgba(255,255,255,.35)' }} />{none} no baseline</span>
        </div>
      </div>

      <div className="idx-side">
        <div className="idx-tiles">
          <div className="idx-tile crit"><b className="mono">{removed}</b><span>Instruments lost</span></div>
          <div className="idx-tile"><b className="mono">{judged}</b><span>With an archive baseline</span></div>
        </div>
        <div className="idx-thesis">
          <h3>A healthy scraper is not the same as preserved knowledge.</h3>
          <p>Every facility below is a live diff of its equipment page against the Wayback archive. Green means the scrape worked <em>and</em> the knowledge survived.</p>
          <button className="btn primary" data-cursor type="button" onClick={onExplore}>
            See the worst losses →
          </button>
        </div>
      </div>
    </section>
  );
}
