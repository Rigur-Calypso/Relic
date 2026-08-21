import { useEffect, useRef } from 'react';

const R = 28;
const C = 2 * Math.PI * R;

export function band(v) {
  return v == null ? 'none' : v >= 90 ? 'good' : v >= 60 ? 'warn' : 'crit';
}
const stroke = (b) =>
  b === 'good' ? 'var(--good)' : b === 'warn' ? 'var(--warn)' : b === 'crit' ? 'var(--crit)' : 'var(--ink-3)';

export default function VitalityRing({ score }) {
  const ref = useRef(null);
  const b = band(score);

  useEffect(() => {
    if (score == null || !ref.current) return;
    const off = C * (1 - score / 100);
    // start empty, then animate to value on next frame
    ref.current.style.strokeDashoffset = String(C);
    const id = requestAnimationFrame(() =>
      requestAnimationFrame(() => { if (ref.current) ref.current.style.strokeDashoffset = String(off); })
    );
    return () => cancelAnimationFrame(id);
  }, [score]);

  if (score == null) {
    return (
      <div className="ring">
        <svg width="64" height="64" viewBox="0 0 64 64">
          <circle className="track" cx="32" cy="32" r={R} fill="none" strokeWidth="6" strokeDasharray="2 6" />
        </svg>
        <div className="num mono" style={{ color: 'var(--ink-3)' }}>—</div>
        <div className="cap">No history</div>
      </div>
    );
  }

  const rounded = Number.isInteger(score) ? score : Math.round(score);
  return (
    <div className="ring">
      <svg width="64" height="64" viewBox="0 0 64 64">
        <circle className="track" cx="32" cy="32" r={R} fill="none" strokeWidth="6" />
        <circle
          ref={ref}
          className="val"
          cx="32" cy="32" r={R} fill="none"
          stroke={stroke(b)} strokeWidth="6"
          strokeDasharray={C.toFixed(1)}
          style={{ strokeDashoffset: C.toFixed(1) }}
        />
      </svg>
      <div className="num mono" style={{ color: stroke(b) }}>{rounded}</div>
      <div className="cap">{b === 'crit' ? '⚠ ' : ''}Vitality</div>
    </div>
  );
}
