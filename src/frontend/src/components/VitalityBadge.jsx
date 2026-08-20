export default function VitalityBadge({ score }) {
  if (score == null) return <span className="text-xs text-gray-400">no history</span>;
  const color = score >= 80 ? 'bg-green-500' : score >= 50 ? 'bg-amber-500' : 'bg-red-500';
  return (
    <div className="flex items-center gap-2">
      <div className={`w-2.5 h-2.5 rounded-full ${color}`} />
      <span className="text-sm font-semibold tabular-nums">{score}</span>
      <span className="text-xs text-gray-400">vitality</span>
    </div>
  );
}
