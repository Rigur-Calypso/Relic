import { useEffect, useMemo, useState, useCallback } from 'react';
import LabCard from './components/LabCard.jsx';

const FILTERS = [
  { key: 'all', label: 'All', dot: 'var(--accent)' },
  { key: 'loss', label: 'Knowledge loss', dot: 'var(--crit)' },
  { key: 'healthy', label: 'Intact', dot: 'var(--good)' },
  { key: 'none', label: 'No baseline', dot: 'var(--ink-3)' },
];

const stateOf = (l) => (l.vitalityScore == null ? 'none' : l.knowledgeLoss ? 'loss' : 'healthy');

export default function App() {
  const [labs, setLabs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [live, setLive] = useState(false);
  const [filter, setFilter] = useState('all');
  const [query, setQuery] = useState('');
  const [busy, setBusy] = useState(null); // { id, kind }

  const load = useCallback(async () => {
    // live API first (full functionality), static baked JSON as fallback
    try {
      const r = await fetch('/api/labs');
      if (!r.ok) throw new Error();
      setLabs(await r.json());
      setLive(true);
    } catch {
      const r = await fetch('/data/labs.json');
      setLabs(await r.json());
      setLive(false);
    }
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  async function onAction(id, kind) {
    if (busy) return;
    setBusy({ id, kind });
    try {
      await fetch(`/api/${kind}/${id}`, { method: 'POST' });
      if (kind !== 'analyze') await fetch(`/api/analyze/${id}`, { method: 'POST' });
      await load();
    } finally {
      setBusy(null);
    }
  }

  const counts = useMemo(() => {
    const c = { all: labs.length, loss: 0, healthy: 0, none: 0 };
    for (const l of labs) c[stateOf(l)]++;
    return c;
  }, [labs]);

  const stats = useMemo(() => ({
    total: labs.length,
    loss: labs.filter((l) => l.knowledgeLoss).length,
    instruments: labs.reduce((s, l) => s + (l.trackingCount || 0), 0),
    withHistory: labs.filter((l) => l.vitalityScore != null).length,
  }), [labs]);

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    return labs.filter((l) =>
      (filter === 'all' || stateOf(l) === filter) &&
      (q === '' || l.name.toLowerCase().includes(q) || (l.url || '').toLowerCase().includes(q))
    );
  }, [labs, filter, query]);

  return (
    <>
      <header className="nav">
        <div className="nav-in">
          <div className="brand">
            <span className="glyph" aria-hidden="true">
              <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                <path d="M10 1.5 18.5 10 10 18.5 1.5 10 10 1.5Z" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
                <path d="M10 6.2 13.8 10 10 13.8 6.2 10 10 6.2Z" fill="currentColor" />
              </svg>
            </span>
            RELIC <small>the self-healing web memory</small>
          </div>
          <div className="search" role="search">
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><circle cx="7" cy="7" r="5" stroke="currentColor" strokeWidth="1.5" /><path d="m11 11 3 3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" /></svg>
            <input type="search" value={query} onChange={(e) => setQuery(e.target.value)}
              placeholder={`Filter ${labs.length || ''} facilities…`} aria-label="Filter facilities" autoComplete="off" />
          </div>
          <span className={`livechip ${live ? '' : 'ro'}`} title={live ? 'Backend connected' : 'Static snapshot'}>
            <span className="pulse" />{live ? 'Live' : 'Snapshot'}
          </span>
        </div>
      </header>

      <main>
        <div className="lede">
          <h1>Knowledge continuity across {labs.length || '100+'} scientific facilities</h1>
          <p><span className="thesis">A healthy scraper is not the same as preserved knowledge.</span>{' '}
            RELIC diffs each lab’s live equipment listing against its Wayback history to catch instruments that were silently decommissioned.</p>
        </div>

        <section className="stats" aria-label="Overview">
          <div className="stat"><div className="n mono">{stats.total}</div><div className="l"><span className="dot" style={{ background: 'var(--accent)' }} />Facilities monitored</div></div>
          <div className="stat crit"><div className="n mono">{stats.loss}</div><div className="l"><span className="dot" style={{ background: 'var(--crit)' }} />Showing knowledge loss</div></div>
          <div className="stat"><div className="n mono">{stats.instruments.toLocaleString()}</div><div className="l"><span className="dot" style={{ background: 'var(--ink-3)' }} />Instruments tracked</div></div>
          <div className="stat"><div className="n mono">{stats.withHistory}</div><div className="l"><span className="dot" style={{ background: 'var(--good)' }} />With historical baseline</div></div>
        </section>

        <div className="filters" role="toolbar" aria-label="Filter by state">
          {FILTERS.map((f) => (
            <button key={f.key} className="chip" aria-pressed={filter === f.key} onClick={() => setFilter(f.key)}>
              {f.key !== 'all' && <span className="dot" style={{ background: f.dot }} />}
              {f.label} <span className="c">{counts[f.key] ?? 0}</span>
            </button>
          ))}
          <span className="count">{loading ? 'Loading…' : `Showing ${shown.length} of ${labs.length} in view`}</span>
        </div>

        <section className="grid" aria-live="polite">
          {loading ? (
            <div className="skeleton">{Array.from({ length: 6 }).map((_, i) => <div className="sk" key={i} />)}</div>
          ) : shown.length ? (
            shown.map((l, i) => (
              <LabCard key={l.id} lab={l} live={live} index={i}
                busy={busy?.id === l.id ? busy.kind : null} onAction={onAction} />
            ))
          ) : (
            <div className="empty">No facilities match this view.</div>
          )}
        </section>
      </main>
    </>
  );
}
