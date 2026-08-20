import VitalityBadge from './VitalityBadge.jsx';

export default function TargetGrid({ targets, analyses, activeId, onSelect }) {
  const byId = Object.fromEntries(analyses.map(a => [a.targetId, a]));
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
      {targets.map(t => {
        const a = byId[t.id];
        const active = t.id === activeId;
        return (
          <button
            key={t.id}
            onClick={() => onSelect(t.id)}
            className={`text-left p-4 rounded-lg border transition
              ${active ? 'border-indigo-400 bg-indigo-500/10' : 'border-gray-700 bg-gray-800/40 hover:border-gray-500'}`}
          >
            <div className="flex justify-between items-start">
              <div className="font-semibold text-gray-100">{t.name}</div>
              {a?.knowledgeLoss && <span className="text-red-400 text-lg leading-none">⚠</span>}
            </div>
            <div className="mt-2"><VitalityBadge score={a ? a.vitalityScore : null} /></div>
          </button>
        );
      })}
    </div>
  );
}
