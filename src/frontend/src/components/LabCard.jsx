import VitalityRing, { band } from './VitalityRing.jsx';

/* derive a country pill from the URL's TLD */
function country(url) {
  let host = '';
  try { host = new URL(url).host; } catch { return null; }
  if (/github\.io|localhost|YOUR_GH/.test(host)) return null;   // decoy placeholder
  const m = [
    [/\.ac\.uk$|\.uk$/, 'UK'], [/\.ac\.in$|\.res\.in$|\.iisc|\.iitb|\.ac\.in/, 'India'],
    [/\.edu\.au$|\.au$/, 'Australia'], [/\.ca$/, 'Canada'], [/\.ch$/, 'Switzerland'],
    [/\.de$/, 'Germany'], [/\.fr$/, 'France'], [/\.nl$/, 'Netherlands'], [/\.se$/, 'Sweden'],
    [/\.fi$/, 'Finland'], [/\.dk$/, 'Denmark'], [/\.be$/, 'Belgium'], [/\.il$/, 'Israel'],
    [/\.ac\.kr$|\.kr$/, 'South Korea'], [/\.ac\.jp$|\.jp$/, 'Japan'], [/\.edu\.sg$|\.sg$/, 'Singapore'],
    [/\.hk$/, 'Hong Kong'], [/\.tw$/, 'Taiwan'], [/\.gov$/, 'USA'], [/\.edu$/, 'USA'],
  ];
  for (const [re, name] of m) if (re.test(host)) return name;
  return host.split('.').slice(-1)[0]?.toUpperCase() || null;
}

/* derive a facility-type pill from the name */
function facilityType(name) {
  const n = name.toLowerCase();
  if (/nanofab|cleanroom|nanoscale|nanofabrication|nano center|nanolab|micro\b|nnfc|cmi|mc2/.test(n)) return 'Cleanroom';
  if (/national|csir|\bnpl\b|nims|argonne|oak ridge|brookhaven|molecular foundry|sandia|nist|pnnl|nrel|ames/.test(n)) return 'National Lab';
  if (/iiser|iisc|jncasr|tifr|research institute/.test(n)) return 'Research Institute';
  return 'University Core';
}

function KnowledgeBlock({ lab }) {
  const { vitalityScore, knowledgeLoss, summary, removed = [], added = [] } = lab;

  if (vitalityScore == null) {
    return (
      <div className="kb kb-none">
        <div className="kb-top"><span className="kb-label">No historical baseline</span></div>
        <div className="kb-sum">{summary || 'Tracking current inventory; no Wayback capture to compare against yet.'}</div>
      </div>
    );
  }
  if (!knowledgeLoss) {
    return (
      <div className="kb kb-good">
        <div className="kb-top"><span className="kb-label">✓ Knowledge intact</span></div>
        <div className="kb-sum">{summary || 'All historical instruments remain present.'}</div>
        {added.length > 0 && <div className="added">＋ {added.length} instrument{added.length > 1 ? 's' : ''} added since baseline</div>}
      </div>
    );
  }
  const shown = removed.slice(0, 4);
  const more = removed.length - shown.length;
  return (
    <div className="kb kb-crit">
      <div className="kb-top">
        <span className="kb-label">Knowledge lost</span>
        <span className="kb-count">{removed.length} removed</span>
      </div>
      <div className="kb-sum">{summary}</div>
      <div className="difflist">
        {shown.map((r, i) => (
          <div className="diff" key={i}>
            <span className="minus">−</span>
            <span className="name" title={r.name}>{r.name}</span>
            <span className={`sev sev-${r.severity || 'moderate'}`}>{r.severity || 'moderate'}</span>
          </div>
        ))}
        {more > 0 && <div className="more">+ {more} more instrument{more > 1 ? 's' : ''} removed</div>}
      </div>
    </div>
  );
}

export default function LabCard({ lab, live, busy, onAction, index = 0 }) {
  const b = band(lab.vitalityScore);
  const type = facilityType(lab.name);
  const loc = country(lab.url);
  const snap = lab.vitalityScore == null ? 'baseline' : 'vs. history';

  return (
    <article className={`card is-${b}`} style={{ animationDelay: `${Math.min(index, 8) * 45}ms` }}>
      <div className="c-head">
        <div className="txt">
          <h2 className="c-name">{lab.name}</h2>
          <div className="pills">
            <span className="pill"><span className="fg" />{type}</span>
            {loc && <span className="pill">{loc}</span>}
            {lab.method === 'ai-heal' && <span className="pill">AI-healed</span>}
          </div>
        </div>
        <VitalityRing score={lab.vitalityScore} />
      </div>

      <KnowledgeBlock lab={lab} />

      <div className="c-foot">
        <span className="track">Tracking <b>{lab.trackingCount}</b> active instrument{lab.trackingCount === 1 ? '' : 's'}</span>
        <span className="snap mono">{snap}</span>
        {live && (
          <div className="actions">
            {['scrape', 'heal', 'analyze'].map((k) => (
              <button
                key={k}
                className={`btn ${k === 'heal' ? 'heal' : ''}`}
                disabled={!!busy}
                onClick={() => onAction(lab.id, k)}
                title={`Run ${k}`}
              >
                {busy === k ? <span className="spin" /> : null}
                <span style={{ textTransform: 'capitalize' }}>{k}</span>
              </button>
            ))}
          </div>
        )}
      </div>
    </article>
  );
}
