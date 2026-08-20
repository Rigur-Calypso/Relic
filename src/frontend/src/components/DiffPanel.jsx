export default function DiffPanel({ analysis }) {
  if (!analysis) return <div className="text-gray-400 p-6">Select a target.</div>;
  const { summary, removed = [], added = [], modified = [], knowledgeLoss } = analysis;
  return (
    <div className="p-6 space-y-5">
      {knowledgeLoss && (
        <div className="border-l-4 border-red-500 bg-red-500/10 p-4 rounded">
          <div className="text-red-400 font-bold text-sm uppercase tracking-wide">⚠ Knowledge Lost</div>
          <div className="text-gray-200 mt-1">{summary}</div>
        </div>
      )}
      {!knowledgeLoss && <div className="text-gray-300">{summary}</div>}

      {removed.length > 0 && (
        <section>
          <h3 className="text-red-400 font-semibold mb-2">Removed since last snapshot</h3>
          <ul className="space-y-1">
            {removed.map((r, i) => (
              <li key={i} className="flex items-center gap-2 text-gray-200">
                <span className={`text-xs px-2 py-0.5 rounded ${r.severity === 'critical' ? 'bg-red-600' : 'bg-amber-600'}`}>
                  {r.severity}
                </span>
                <span className="font-medium">{r.name}</span>
                {r.reason && <span className="text-gray-500 text-sm">— {r.reason}</span>}
              </li>
            ))}
          </ul>
        </section>
      )}

      {modified.length > 0 && (
        <section>
          <h3 className="text-amber-400 font-semibold mb-2">Modified</h3>
          <ul className="space-y-1 text-gray-300">
            {modified.map((m, i) => <li key={i}><span className="font-medium">{m.name}</span> — {m.change}</li>)}
          </ul>
        </section>
      )}

      {added.length > 0 && (
        <section>
          <h3 className="text-green-400 font-semibold mb-2">Added</h3>
          <ul className="space-y-1 text-gray-300">{added.map((a, i) => <li key={i}>{a.name}</li>)}</ul>
        </section>
      )}
    </div>
  );
}
