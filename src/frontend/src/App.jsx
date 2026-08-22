import { useEffect, useMemo, useState, useCallback, useRef } from 'react';
import Cursor from './components/Cursor.jsx';
import Globe from './components/Globe.jsx';
import LabCard from './components/LabCard.jsx';
import LabDetail from './components/LabDetail.jsx';
import LabRow from './components/LabRow.jsx';
import IndexBand from './components/IndexBand.jsx';
import Splash from './components/Splash.jsx';

const parseRoute = () => {
  const m = (window.location.hash || '').match(/^#\/lab\/(.+)$/);
  return m ? { view: 'lab', id: decodeURIComponent(m[1]) } : { view: 'home' };
};

const FILTERS = [
  { key: 'all', label: 'All', dot: 'var(--g2)' },
  { key: 'loss', label: 'Knowledge loss', dot: 'var(--crit)' },
  { key: 'healthy', label: 'Intact', dot: 'var(--good)' },
  { key: 'none', label: 'No baseline', dot: 'var(--ink-3)' },
];
const stateOf = (l) => (l.vitalityScore == null ? 'none' : l.knowledgeLoss ? 'loss' : 'healthy');

function CountUp({ to }) {
  const [n, setN] = useState(0);
  useEffect(() => {
    let raf, t0; const dur = 1500;
    const step = (t) => { if (!t0) t0 = t; const k = Math.min(1, (t - t0) / dur); setN(Math.round(to * (1 - Math.pow(1 - k, 3)))); if (k < 1) raf = requestAnimationFrame(step); };
    raf = requestAnimationFrame(step);
    // rAF is paused in a hidden tab; snap to the real value so the stat never
    // sticks on a partial number.
    const settle = setTimeout(() => setN(to), dur + 150);
    return () => { cancelAnimationFrame(raf); clearTimeout(settle); };
  }, [to]);
  return <>{n.toLocaleString()}</>;
}

export default function App() {
  const [splashDone, setSplashDone] = useState(false);
  const [route, setRoute] = useState(parseRoute);
  const [labs, setLabs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [live, setLive] = useState(false);
  const [filter, setFilter] = useState('all');
  const [view, setView] = useState('ranked');
  const [query, setQuery] = useState('');
  const [busy, setBusy] = useState(null);
  const [lookupQ, setLookupQ] = useState('');
  const [lookupBusy, setLookupBusy] = useState(false);
  const [lookupResult, setLookupResult] = useState(null);
  const [lookupError, setLookupError] = useState('');
  const dashRef = useRef(null);
  const lookupRef = useRef(null);
  const onSplashDone = useCallback(() => setSplashDone(true), []);

  const load = useCallback(async () => {
    try {
      const r = await fetch('/api/labs'); if (!r.ok) throw new Error();
      setLabs(await r.json()); setLive(true);
    } catch {
      const r = await fetch('/data/labs.json'); setLabs(await r.json()); setLive(false);
    }
    setLoading(false);
  }, []);
  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    const onHash = () => setRoute(parseRoute());
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);
  // A detail deep-link should skip the splash so the page is immediately usable.
  useEffect(() => { if (route.view === 'lab') setSplashDone(true); }, [route.view]);

  async function onAction(id, kind) {
    if (busy) return; setBusy({ id, kind });
    try {
      await fetch(`/api/${kind}/${id}`, { method: 'POST' });
      if (kind !== 'analyze') await fetch(`/api/analyze/${id}`, { method: 'POST' });
      await load();
    } finally { setBusy(null); }
  }

  async function runLookup(e) {
    e?.preventDefault(); const name = lookupQ.trim(); if (!name || lookupBusy) return;
    setLookupBusy(true); setLookupError(''); setLookupResult(null);
    try {
      const r = await fetch('/api/lookup', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name }) });
      const data = await r.json(); if (!r.ok) throw new Error(data.error || 'Lookup failed');
      setLookupResult(data);
    } catch (err) { setLookupError(err.message || 'Lookup failed'); }
    finally { setLookupBusy(false); }
  }

  const openLab = useCallback((lab) => {
    if (!lab?.id) return;
    window.location.hash = `#/lab/${encodeURIComponent(lab.id)}`;
  }, []);
  const closeLab = useCallback(() => {
    if (window.location.hash) { history.pushState('', document.title, window.location.pathname + window.location.search); }
    setRoute({ view: 'home' });
  }, []);

  const counts = useMemo(() => { const c = { all: labs.length, loss: 0, healthy: 0, none: 0 }; for (const l of labs) c[stateOf(l)]++; return c; }, [labs]);
  const stats = useMemo(() => ({
    total: labs.length,
    loss: labs.filter((l) => l.knowledgeLoss).length,
    instruments: labs.reduce((s, l) => s + (l.trackingCount || 0), 0),
    withHistory: labs.filter((l) => l.vitalityScore != null).length,
    intact: labs.filter((l) => l.vitalityScore != null && !l.knowledgeLoss).length,
    none: labs.filter((l) => l.vitalityScore == null).length,
    removed: labs.reduce((s2, l) => s2 + (l.removed || []).length, 0),
  }), [labs]);
  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    return labs.filter((l) => (filter === 'all' || stateOf(l) === filter) &&
      (q === '' || l.name.toLowerCase().includes(q) || (l.url || '').toLowerCase().includes(q)));
  }, [labs, filter, query]);
  // Worst-first ordering for the ranked view; unjudged facilities sink to the bottom.
  const ranked = useMemo(() => [...shown].sort((a, b) => {
    const av = a.vitalityScore, bv = b.vitalityScore;
    if (av == null && bv == null) return (b.trackingCount || 0) - (a.trackingCount || 0);
    if (av == null) return 1;
    if (bv == null) return -1;
    return av - bv || (b.removed || []).length - (a.removed || []).length;
  }), [shown]);
  const marquee = useMemo(() => labs.filter((l) => l.vitalityScore != null).slice(0, 18).map((l) => l.name), [labs]);

  const scrollTo = (ref) => ref.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });

  return (
    <>
      {!splashDone && <Splash onDone={onSplashDone} />}
      <Cursor />
      <div className={`app-main ${splashDone ? 'app-in' : ''}`}>
      <div className="aurora" /><div className="orb a" /><div className="orb b" /><div className="orb c" />

      {route.view === 'lab' ? (
        <LabDetail id={route.id} live={live} seed={labs.find((l) => l.id === route.id)}
          onBack={closeLab} busy={busy?.id === route.id ? busy.kind : null} anyBusy={!!busy} onAction={onAction} />
      ) : (
      <>
      <nav className="nav">
        <div className="brand"><span className="dia" />RELIC</div>
        <div className="links">
          <a href="#dash" onClick={(e) => { e.preventDefault(); scrollTo(dashRef); }}>Facilities</a>
          <a href="#dash" onClick={(e) => { e.preventDefault(); setFilter('loss'); scrollTo(dashRef); }}>Knowledge loss</a>
          <a href="#lookup" onClick={(e) => { e.preventDefault(); scrollTo(lookupRef); }}>On-demand</a>
        </div>
        <span className={`live ${live ? '' : 'ro'}`}><span className="p" />{live ? 'Live' : 'Snapshot'}</span>
        <button className="cta" data-cursor type="button" onClick={() => scrollTo(lookupRef)}>Analyze a facility</button>
      </nav>

      <header className="hero">
        <div className="eyebrow"><span className="live" />Live · {labs.length || '116'} facilities across 5 continents</div>
        <h1 className="hero-h">The web quietly <span className="grad">forgets.</span><br />RELIC remembers.</h1>
        <p className="sub"><b>A healthy scraper is not the same as preserved knowledge.</b> RELIC diffs every lab’s live equipment page against its Wayback history — and catches the instruments that silently disappear.</p>

        <Globe labs={labs} onSelect={openLab} />

        <div className="stats">
          <div className="chip"><div className="n mono"><CountUp to={stats.total} /></div><div className="l">Facilities monitored</div></div>
          <div className="chip"><div className="n mono"><CountUp to={stats.instruments} /></div><div className="l">Instruments tracked</div></div>
          <div className="chip crit"><div className="n mono"><CountUp to={stats.loss} /></div><div className="l">Showing knowledge loss</div></div>
        </div>
        <div className="cta-row">
          <button className="btn primary" data-cursor type="button" onClick={() => scrollTo(dashRef)}>Explore the dashboard →</button>
          <button className="btn ghost" data-cursor type="button" onClick={() => scrollTo(lookupRef)}>Name any college ✦</button>
        </div>
      </header>

      {marquee.length > 0 && (
        <div className="marquee"><div className="mtrack">
          {[...marquee, ...marquee].map((n, i) => (<span key={i}>{n}<span style={{ margin: '0 -20px 0 18px', opacity: .5 }}>·</span></span>))}
        </div></div>
      )}

      <section className="dash" id="dash" ref={dashRef}>
        {!loading && labs.length > 0 && (
          <IndexBand stats={stats} onExplore={() => { setFilter('loss'); setView('ranked'); }} />
        )}

        <h2>The knowledge continuity map</h2>
        <p className="lead">Every card is a live diff of a facility’s equipment page against its Wayback history. Point to any dot on the globe to jump to it.</p>

        <form className={`lookup ${!live ? 'lookup-disabled' : ''}`} id="lookup" ref={lookupRef} onSubmit={runLookup}>
          <div className="field">
            <span className="k"><svg width="17" height="17" viewBox="0 0 16 16" fill="none"><path d="M8 1.5 14 5v6l-6 3.5L2 11V5l6-3.5Z" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round" /><path d="M8 5.2 10.6 6.7v3L8 11.2 5.4 9.7v-3L8 5.2Z" fill="currentColor" /></svg></span>
            <input data-cursor value={lookupQ} onChange={(e) => setLookupQ(e.target.value)} disabled={!live}
              placeholder={live ? 'Name any institution — e.g. “University of Tokyo” — to scrape & diff it live' : 'Start the API server to enable on-demand analysis'} />
          </div>
          <button className="go" data-cursor type="submit" disabled={!live || lookupBusy || !lookupQ.trim()}>
            {lookupBusy ? <><span className="spin" />Scraping…</> : 'Analyze on demand'}
          </button>
          <div className={`hint ${lookupError ? 'err' : ''}`}>
            {!live ? 'On-demand analysis requires the live API server. Currently viewing a static snapshot.'
              : lookupError ? `Couldn't analyze that: ${lookupError}` : 'Bright Data finds the page, scrapes it, pulls the Wayback version, and Gemini diffs them — in ~30s.'}
          </div>
        </form>

        {lookupResult && (
          <div className="adhoc">
            <div className="lbl">◆ On-demand result<button type="button" className="x" data-cursor onClick={() => setLookupResult(null)}>✕ dismiss</button></div>
            <LabCard lab={lookupResult} live={false} />
          </div>
        )}

        <div className="filters">
          <div className="dsearch">
            <svg width="15" height="15" viewBox="0 0 16 16" fill="none"><circle cx="7" cy="7" r="5" stroke="currentColor" strokeWidth="1.5" /><path d="m11 11 3 3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" /></svg>
            <input data-cursor value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search facilities…" />
          </div>
          {FILTERS.map((f) => (
            <button key={f.key} className="dchip" data-cursor type="button" aria-pressed={filter === f.key} onClick={() => setFilter(f.key)}>
              {f.key !== 'all' && <span className="dot" style={{ background: f.dot }} />}{f.label} <span className="c">{counts[f.key] ?? 0}</span>
            </button>
          ))}
          <div className="vtoggle" role="group" aria-label="Result layout">
            <button type="button" data-cursor aria-pressed={view === 'ranked'} onClick={() => setView('ranked')}>Ranked</button>
            <button type="button" data-cursor aria-pressed={view === 'grid'} onClick={() => setView('grid')}>Grid</button>
          </div>
          <span className="count">{loading ? 'Loading…' : `Showing ${shown.length} of ${labs.length}`}{view === 'ranked' && !loading ? ' · worst first' : ''}</span>
        </div>

        {loading ? (
          <div className="grid"><div className="skeleton">{Array.from({ length: 6 }).map((_, i) => <div className="sk" key={i} />)}</div></div>
        ) : !shown.length ? (
          <div className="grid"><div className="empty">No facilities match this view.</div></div>
        ) : view === 'ranked' ? (
          <div className="lrows">
            {ranked.map((l, i) => <LabRow key={l.id} lab={l} rank={i + 1} onOpen={openLab} />)}
          </div>
        ) : (
          <div className="grid">
            {shown.map((l, i) => (
              <LabCard key={l.id} lab={l} live={live} index={i} onOpen={openLab}
                busy={busy?.id === l.id ? busy.kind : null} anyBusy={!!busy} onAction={onAction} />
            ))}
          </div>
        )}
      </section>

      <footer>RELIC · the self-healing web memory — a Bright Data × Gemini pipeline monitoring {labs.length || '100+'} facilities.</footer>
      </>
      )}
      </div>
    </>
  );
}
