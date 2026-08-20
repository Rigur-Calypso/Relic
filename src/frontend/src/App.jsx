import { useEffect, useState, useCallback } from 'react';
import TargetGrid from './components/TargetGrid.jsx';
import DiffPanel from './components/DiffPanel.jsx';
import VitalityBadge from './components/VitalityBadge.jsx';

export default function App() {
  const [targets, setTargets] = useState([]);
  const [analyses, setAnalyses] = useState([]);
  const [activeId, setActiveId] = useState(null);
  const [busy, setBusy] = useState('');
  const [live, setLive] = useState(true);   // backend present? (false on static deploy)

  const load = useCallback(async () => {
    // Progressive: use the Express API when available (full functionality locally),
    // otherwise fall back to the JSON baked into /data (the static Vercel deploy).
    async function getJSON(apiPath, staticPath) {
      try {
        const r = await fetch(apiPath);
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return { data: await r.json(), live: true };
      } catch {
        const r = await fetch(staticPath);
        return { data: await r.json(), live: false };
      }
    }
    const t = await getJSON('/api/targets', '/data/targets.json');
    const a = await getJSON('/api/analysis', '/data/analysis.json');
    setTargets(t.data);
    setAnalyses(Array.isArray(a.data) ? a.data : []);
    setLive(t.live && a.live);
    if (!activeId && t.data.length) setActiveId(t.data[0].id);
  }, [activeId]);

  useEffect(() => { load(); }, [load]);

  const active = analyses.find(a => a.targetId === activeId);

  async function trigger(kind) {
    if (!activeId) return;
    setBusy(kind);
    await fetch(`/api/${kind}/${activeId}`, { method: 'POST' }).then(r => r.json());
    if (kind !== 'analyze') await fetch(`/api/analyze/${activeId}`, { method: 'POST' });
    await load();
    setBusy('');
  }

  return (
    <div className="h-screen flex flex-col bg-gray-900 text-gray-100">
      <header className="px-8 py-5 border-b border-gray-800 shrink-0 flex items-baseline justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">RELIC <span className="text-indigo-400">· the self-healing web memory</span></h1>
          <p className="text-gray-400 text-sm">A healthy scraper is not the same as preserved knowledge.</p>
        </div>
        <div className="text-xs text-gray-500">
          <span className="text-gray-300 font-semibold tabular-nums">{targets.length}</span> labs monitored
          {' · '}
          <span className="text-red-400 font-semibold tabular-nums">{analyses.filter(a => a.knowledgeLoss).length}</span> with knowledge loss
        </div>
      </header>

      <div className="flex-1 min-h-0 grid grid-cols-1 lg:grid-cols-[420px_1fr]">
        <aside className="p-6 border-r border-gray-800 overflow-y-auto">
          {live ? (
            <div className="flex gap-2 mb-4">
              {['scrape', 'heal', 'analyze'].map(k => (
                <button key={k} disabled={!!busy} onClick={() => trigger(k)}
                  className="px-3 py-1.5 text-sm rounded bg-gray-800 hover:bg-gray-700 disabled:opacity-50 capitalize">
                  {busy === k ? `${k}…` : k}
                </button>
              ))}
            </div>
          ) : (
            <div className="mb-4 text-xs text-gray-500 border border-gray-800 rounded px-3 py-2">
              Static snapshot of a live pipeline run. Clone the repo and run the backend
              for live scrape / heal / analyze.
            </div>
          )}
          <TargetGrid targets={targets} analyses={analyses} activeId={activeId} onSelect={setActiveId} />
        </aside>

        <main className="overflow-y-auto">
          <div className="px-6 pt-6 flex items-center justify-between gap-4 flex-wrap">
            <div className="text-lg font-semibold">
              {targets.find(t => t.id === activeId)?.name || '—'}
            </div>
            {active && <VitalityBadge score={active.vitalityScore} />}
          </div>
          <DiffPanel analysis={active} />
        </main>
      </div>
    </div>
  );
}
