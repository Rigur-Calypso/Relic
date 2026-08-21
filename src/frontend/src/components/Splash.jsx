import { useState, useEffect } from 'react';

// Premium intro splash — a cinematic reveal animation inspired by high-end presentation slides.
// Shows the RELIC brand with staggered animations, then wipes away to reveal the main app.
export default function Splash({ onDone }) {
  const [phase, setPhase] = useState(0); // 0=entering, 1=holding, 2=exiting, 3=done

  useEffect(() => {
    // Phase 0 → 1: Elements animate in (handled by CSS animation delays)
    const t1 = setTimeout(() => setPhase(1), 100);
    // Phase 1 → 2: Hold the splash for a moment, then start exit
    const t2 = setTimeout(() => setPhase(2), 2400);
    // Phase 2 → 3: Exit animation finishes, unmount
    const t3 = setTimeout(() => { setPhase(3); onDone(); }, 3200);
    return () => { clearTimeout(t1); clearTimeout(t2); clearTimeout(t3); };
  }, [onDone]);

  if (phase === 3) return null;

  return (
    <div className={`splash ${phase >= 2 ? 'splash-exit' : ''}`}>
      {/* Animated background orbs */}
      <div className="sp-orb sp-orb-1" />
      <div className="sp-orb sp-orb-2" />
      <div className="sp-orb sp-orb-3" />

      {/* Content */}
      <div className="sp-content">
        <div className={`sp-diamond ${phase >= 1 ? 'sp-in' : ''}`} />
        <h1 className={`sp-title ${phase >= 1 ? 'sp-in' : ''}`}>RELIC</h1>
        <div className={`sp-line ${phase >= 1 ? 'sp-in' : ''}`} />
        <p className={`sp-tagline ${phase >= 1 ? 'sp-in' : ''}`}>
          The self-healing web memory
        </p>
        <div className={`sp-dots ${phase >= 1 ? 'sp-in' : ''}`}>
          <span /><span /><span />
        </div>
      </div>
    </div>
  );
}
