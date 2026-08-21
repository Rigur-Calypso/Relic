import { useRef, useEffect } from 'react';
import { countryOf } from '../geo.js';

const bandColor = (v) => v == null ? null : v >= 90 ? '#12B26B' : v >= 60 ? '#E8990C' : '#F0435A';

function facilityType(name) {
  const n = name.toLowerCase();
  if (/nanofab|cleanroom|nanoscale|nanofabrication|nano center|nanolab|nnfc|cmi|mc2/.test(n)) return 'Cleanroom';
  if (/national|csir|\bnpl\b|nims|argonne|oak ridge|brookhaven|molecular foundry|sandia|nist|pnnl|nrel|ames/.test(n)) return 'National Lab';
  if (/iiser|iisc|jncasr|tifr|research institute/.test(n)) return 'Research Institute';
  return 'University Core';
}

export default function LabCard({ lab, live, busy, anyBusy, onAction, index = 0, highlighted }) {
  const ref = useRef(null);
  const v = lab.vitalityScore;
  const color = bandColor(v);
  const type = facilityType(lab.name);
  const loc = countryOf(lab.url);
  const state = v == null ? 'none' : lab.knowledgeLoss ? 'loss' : 'ok';
  const removed = lab.removed || [];
  const shown = removed.slice(0, 3);
  const more = removed.length - shown.length;

  useEffect(() => {
    const el = ref.current; if (!el) return;
    const io = new IntersectionObserver((es) => es.forEach((e) => { if (e.isIntersecting) { el.classList.add('in'); io.disconnect(); } }), { threshold: 0.12 });
    io.observe(el); return () => io.disconnect();
  }, []);

  function onMove(e) {
    const el = ref.current; if (!el) return;
    const r = el.getBoundingClientRect();
    const px = (e.clientX - r.left) / r.width - 0.5, py = (e.clientY - r.top) / r.height - 0.5;
    el.style.transform = `rotateY(${px * 8}deg) rotateX(${-py * 8}deg) translateY(-4px)`;
  }
  const reset = () => { if (ref.current) ref.current.style.transform = ''; };

  return (
    <article ref={ref} id={`lab-${lab.id}`}
      className={`tcard ${highlighted ? 'hl' : ''}`}
      style={{ animationDelay: `${Math.min(index, 9) * 40}ms` }}
      onMouseMove={onMove} onMouseLeave={reset}>
      <div className="L">
        <div className="top">
          <div>
            <h3 className="name">{lab.name}</h3>
            <div className="loc">{[type, loc, lab.method === 'ai-heal' ? 'AI-healed' : null].filter(Boolean).join(' · ')}</div>
          </div>
          <div className={`score ${v == null ? 'none' : ''}`}
            style={v == null ? undefined : { background: `linear-gradient(135deg,${color},${color})`, boxShadow: `0 10px 20px -8px ${color}` }}>
            {v == null ? '—' : Math.round(v)}
          </div>
        </div>

        {state === 'loss' && <span className="badge loss">⚠ {removed.length} removed</span>}
        {state === 'ok' && <span className="badge ok">✓ knowledge intact</span>}
        {state === 'none' && <span className="badge non">no baseline</span>}

        <div className="desc">{lab.summary || (state === 'none' ? 'Tracking current inventory; no Wayback capture to compare yet.' : '')}</div>

        {state === 'loss' && removed.length > 0 && (
          <div className="removed">
            {shown.map((r, i) => (
              <div className="r" key={i}>
                <span className="m">−</span>
                <span className="t" title={r.name}>{r.name}</span>
                <span className={`sev ${r.severity || 'moderate'}`}>{r.severity || 'moderate'}</span>
              </div>
            ))}
            {more > 0 && <div className="more">+ {more} more removed</div>}
          </div>
        )}
        {state === 'ok' && (lab.added || []).length > 0 && (
          <div className="added">＋ {lab.added.length} instrument{lab.added.length > 1 ? 's' : ''} added since baseline</div>
        )}

        <div className="foot">
          <span>Tracking <b>{lab.trackingCount}</b> instrument{lab.trackingCount === 1 ? '' : 's'}</span>
          {live && (
            <div className="acts">
              {['scrape', 'heal', 'analyze'].map((k) => (
                <button key={k} className={`act ${k === 'heal' ? 'heal' : ''}`} data-cursor disabled={anyBusy}
                  onClick={() => onAction(lab.id, k)} title={`Run ${k}`}>
                  {busy === k ? <span className="spin" /> : null}<span style={{ textTransform: 'capitalize' }}>{k}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </article>
  );
}
