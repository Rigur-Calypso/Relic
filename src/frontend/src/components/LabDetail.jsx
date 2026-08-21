import { useEffect, useState } from 'react';
import { countryOf } from '../geo.js';

const bandColor = (v) => v == null ? '#9AA0B8' : v >= 90 ? '#12B26B' : v >= 60 ? '#E8990C' : '#F0435A';
const bandLabel = (v) => v == null ? 'No baseline' : v >= 90 ? 'Knowledge intact' : v >= 60 ? 'Partial drift' : 'Knowledge loss';

function facilityType(name = '') {
  const n = name.toLowerCase();
  if (/nanofab|cleanroom|nanoscale|nanofabrication|nano center|nanolab|nnfc|cmi|mc2/.test(n)) return 'Cleanroom';
  if (/national|csir|\bnpl\b|nims|argonne|oak ridge|brookhaven|molecular foundry|sandia|nist|pnnl|nrel|ames/.test(n)) return 'National Lab';
  if (/iiser|iisc|jncasr|tifr|research institute/.test(n)) return 'Research Institute';
  return 'University Core';
}

const fmtDate = (s) => { if (!s) return null; const d = new Date(s); return isNaN(d) ? null : d.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' }); };
const waybackDate = (ts) => { // e.g. "20240110085753" or "~20240101"
  const s = String(ts ?? '').replace(/\D/g, ''); // drop "~" and any separators
  if (s.length < 8) return null;
  const d = new Date(`${s.slice(0, 4)}-${s.slice(4, 6)}-${s.slice(6, 8)}`);
  return isNaN(d) ? null : d.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
};

export default function LabDetail({ id, live, seed, onBack, busy, anyBusy, onAction }) {
  const [detail, setDetail] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let alive = true;
    setLoading(true); setError(''); setDetail(null);
    (async () => {
      try {
        let r = await fetch(`/api/lab/${id}`);
        if (!r.ok) throw new Error();
        if (alive) setDetail(await r.json());
      } catch {
        try {
          const r = await fetch(`/data/labs/${id}.json`);
          if (!r.ok) throw new Error('not found');
          if (alive) setDetail(await r.json());
        } catch { if (alive) setError('Could not load this facility.'); }
      } finally { if (alive) setLoading(false); }
    })();
    return () => { alive = false; };
  }, [id, busy]);

  useEffect(() => { window.scrollTo({ top: 0 }); }, [id]);

  const target = detail?.target || seed || { id, name: seed?.name || id };
  const analysis = detail?.analysis;
  const current = detail?.current;
  const historical = detail?.historical;

  const v = analysis?.vitalityScore ?? seed?.vitalityScore ?? null;
  const color = bandColor(v);
  const removed = analysis?.removed || [];
  const added = analysis?.added || [];
  const modified = analysis?.modified || [];
  const equipment = current?.equipment || [];
  const histEquip = historical?.equipment || [];
  const country = countryOf(target.url);
  const type = facilityType(target.name);
  const scraped = fmtDate(current?.scrapedAt || seed?.scrapedAt);
  const snapDate = waybackDate(historical?.snapshotTimestamp);

  return (
    <div className="detail">
      <div className="det-topbar">
        <button className="det-back" data-cursor type="button" onClick={onBack}>
          <span className="ar">←</span> All facilities
        </button>
        <span className={`live ${live ? '' : 'ro'}`}><span className="p" />{live ? 'Live' : 'Snapshot'}</span>
      </div>

      <header className="det-hero">
        <div className="det-hero-l">
          <div className="det-kicker">{[type, country].filter(Boolean).join(' · ')}</div>
          <h1 className="det-name">{target.name}</h1>
          {target.url && (
            <a className="det-url" href={target.url} target="_blank" rel="noopener noreferrer" data-cursor>
              {target.url.replace(/^https?:\/\//, '').replace(/\/$/, '')} ↗
            </a>
          )}
          <div className="det-meta">
            {current?.method && <span className="mtag">{current.method === 'ai-heal' ? '✦ AI-healed extraction' : 'CSS-selector extraction'}</span>}
            {scraped && <span className="mtag">Scraped {scraped}</span>}
            {snapDate && <span className="mtag">Baseline {snapDate}</span>}
            <span className="mtag">{equipment.length} instrument{equipment.length === 1 ? '' : 's'} tracked</span>
          </div>
        </div>
        <div className="det-score-wrap">
          <div className="det-score" style={{ '--c': color }}>
            <span className="det-score-n">{v == null ? '—' : Math.round(v)}</span>
            <span className="det-score-u">{v == null ? '' : '/ 100'}</span>
          </div>
          <div className="det-score-l" style={{ color }}>{bandLabel(v)}</div>
          <div className="det-score-cap">Vitality score</div>
        </div>
      </header>

      {loading && <div className="det-loading"><span className="spin" /> Loading facility detail…</div>}
      {error && !loading && <div className="det-error">{error}</div>}

      {!loading && !error && (
        <>
          {(analysis?.summary || seed?.summary) && (
            <div className={`det-summary ${v == null ? 'none' : v < 90 ? (v < 60 ? 'loss' : 'warn') : 'ok'}`}>
              <div className="det-summary-h">What the diff found</div>
              <p>{analysis?.summary || seed?.summary}</p>
            </div>
          )}

          <div className="det-tallies">
            <div className="tally loss"><b>{removed.length}</b><span>Removed</span></div>
            <div className="tally add"><b>{added.length}</b><span>Added</span></div>
            <div className="tally mod"><b>{modified.length}</b><span>Modified</span></div>
            <div className="tally keep"><b>{equipment.length}</b><span>On live page</span></div>
          </div>

          {removed.length > 0 && (
            <section className="det-block">
              <h2 className="det-h loss">⚠ Instruments the page silently lost</h2>
              <div className="det-list">
                {removed.map((r, i) => (
                  <div className="det-item loss" key={i}>
                    <div className="det-item-top">
                      <span className="det-item-name">{r.name}</span>
                      <span className={`sev ${r.severity || 'moderate'}`}>{r.severity || 'moderate'}</span>
                    </div>
                    {r.reason && <div className="det-item-reason">{r.reason}</div>}
                  </div>
                ))}
              </div>
            </section>
          )}

          {added.length > 0 && (
            <section className="det-block">
              <h2 className="det-h add">＋ Instruments added since the baseline</h2>
              <div className="det-chips">
                {added.map((a, i) => <span className="det-chip add" key={i}>{a.name || a}</span>)}
              </div>
            </section>
          )}

          {modified.length > 0 && (
            <section className="det-block">
              <h2 className="det-h mod">↻ Instruments that changed</h2>
              <div className="det-list">
                {modified.map((m, i) => (
                  <div className="det-item mod" key={i}>
                    <div className="det-item-top"><span className="det-item-name">{m.name}</span></div>
                    {m.change && <div className="det-item-reason">{m.change}</div>}
                  </div>
                ))}
              </div>
            </section>
          )}

          <section className="det-block">
            <h2 className="det-h">Current live inventory <span className="det-h-c">{equipment.length}</span></h2>
            {equipment.length === 0 ? (
              <div className="det-empty">No instruments captured on the current page.</div>
            ) : (
              <div className="det-table-wrap">
                <table className="det-table">
                  <thead><tr><th>Instrument</th><th>Specifications</th><th>Location</th><th>Status</th></tr></thead>
                  <tbody>
                    {equipment.map((e, i) => (
                      <tr key={i}>
                        <td className="nm">{e.name}</td>
                        <td>{e.specifications || <span className="dash">—</span>}</td>
                        <td>{e.location || <span className="dash">—</span>}</td>
                        <td>{e.status || <span className="dash">—</span>}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          {histEquip.length > 0 && (
            <section className="det-block">
              <h2 className="det-h">Wayback baseline <span className="det-h-c">{histEquip.length}</span></h2>
              {historical?.snapshotUrl && (
                <a className="det-url sm" href={historical.snapshotUrl} target="_blank" rel="noopener noreferrer" data-cursor>
                  View the archived snapshot{snapDate ? ` from ${snapDate}` : ''} ↗
                </a>
              )}
              <div className="det-chips hist">
                {histEquip.map((e, i) => {
                  const gone = removed.some((r) => (r.name || '').toLowerCase() === (e.name || '').toLowerCase());
                  return <span className={`det-chip ${gone ? 'gone' : ''}`} key={i}>{e.name}</span>;
                })}
              </div>
            </section>
          )}

          {live && onAction && (
            <div className="det-actions">
              {['scrape', 'heal', 'analyze'].map((k) => (
                <button key={k} className={`btn ${k === 'heal' ? 'ghost' : k === 'analyze' ? 'primary' : 'ghost'}`}
                  data-cursor disabled={anyBusy} onClick={() => onAction(target.id, k)}>
                  {busy === k ? <span className="spin" /> : null} <span style={{ textTransform: 'capitalize' }}>{k}</span>
                </button>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
