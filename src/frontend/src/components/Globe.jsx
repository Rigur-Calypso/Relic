import { useEffect, useRef, useState } from 'react';
import { latLngOf, latLngToXYZ } from '../geo.js';

const bandColor = (v) => v == null ? '#C9CEE0' : v >= 90 ? '#12B26B' : v >= 60 ? '#E8990C' : '#F0435A';

export default function Globe({ labs, onSelect }) {
  const cv = useRef(null);
  const wrap = useRef(null);
  const [tip, setTip] = useState(null); // { name, v, x, y }

  useEffect(() => {
    const canvas = cv.current; if (!canvas || !labs.length) return;
    const ctx = canvas.getContext('2d');
    const W = canvas.width, H = canvas.height, cx = W / 2, cy = H / 2, R = W * 0.32, FOCAL = 2.8;
    const reduce = matchMedia('(prefers-reduced-motion:reduce)').matches;

    const pts = labs.map((l) => {
      const [lat, lng] = latLngOf(l);
      const [x, y, z] = latLngToXYZ(lat, lng);
      return { x, y, z, color: bandColor(l.vitalityScore), lab: l };
    });

    let ang = 0.6, targetSpin = 0, mouseNX = 0, hover = -1, raf;
    const proj = new Array(pts.length);

    function project() {
      const sa = Math.sin(ang), ca = Math.cos(ang), TL = -0.35, stl = Math.sin(TL), ctl = Math.cos(TL);
      for (let i = 0; i < pts.length; i++) {
        const p = pts[i];
        const x1 = p.x * ca - p.z * sa, z1 = p.x * sa + p.z * ca, y1 = p.y;
        const y2 = y1 * ctl - z1 * stl, z2 = y1 * stl + z1 * ctl;
        const k = FOCAL / (FOCAL - z2);
        proj[i] = { sx: cx + x1 * R * k, sy: cy - y2 * R * k, depth: z2, k, i };
      }
    }
    function frame() {
      ctx.clearRect(0, 0, W, H);
      project();
      const order = [...proj].sort((a, b) => a.depth - b.depth);
      for (const q of order) {
        const p = pts[q.i], f = (q.depth + 1) / 2;
        const isH = q.i === hover;
        const rad = (isH ? 9 : 2.6 + f * 6) * q.k, a = isH ? 1 : 0.25 + f * 0.75;
        const g = ctx.createRadialGradient(q.sx, q.sy, 0, q.sx, q.sy, rad * (isH ? 3.4 : 2.6));
        g.addColorStop(0, p.color); g.addColorStop(1, p.color + '00');
        ctx.globalAlpha = a * (isH ? 0.7 : 0.45); ctx.fillStyle = g;
        ctx.beginPath(); ctx.arc(q.sx, q.sy, rad * (isH ? 3.4 : 2.6), 0, 7); ctx.fill();
        ctx.globalAlpha = a; ctx.fillStyle = p.color;
        ctx.beginPath(); ctx.arc(q.sx, q.sy, rad, 0, 7); ctx.fill();
        if (isH) { ctx.globalAlpha = 1; ctx.strokeStyle = '#fff'; ctx.lineWidth = 2; ctx.stroke(); }
      }
      ctx.globalAlpha = 1;
      ang += (reduce ? 0 : 0.003) + targetSpin * 0.02 + mouseNX * 0.004;
      raf = requestAnimationFrame(frame);
    }
    frame();

    // interaction — hit-test in canvas-internal coords
    function toInternal(e) {
      const r = canvas.getBoundingClientRect();
      return { ix: (e.clientX - r.left) / r.width * W, iy: (e.clientY - r.top) / r.height * H, r };
    }
    function onMove(e) {
      const { ix, iy, r } = toInternal(e);
      mouseNX = ((e.clientX - r.left) / r.width - 0.5) * 2;
      let best = -1, bd = 22 * 22;
      for (let i = 0; i < proj.length; i++) {
        if (proj[i].depth < -0.15) continue; // only front hemisphere
        const dx = proj[i].sx - ix, dy = proj[i].sy - iy, d = dx * dx + dy * dy;
        if (d < bd) { bd = d; best = i; }
      }
      hover = best;
      if (best >= 0) {
        const l = pts[best].lab;
        setTip({ name: l.name, v: l.vitalityScore, x: r.left + proj[best].sx / W * r.width, y: r.top + proj[best].sy / H * r.height });
        canvas.style.cursor = 'pointer';
      } else { setTip(null); canvas.style.cursor = ''; }
    }
    function onLeave() { hover = -1; mouseNX = 0; setTip(null); }
    function onClick() { if (hover >= 0 && onSelect) onSelect(pts[hover].lab); }
    canvas.addEventListener('mousemove', onMove);
    canvas.addEventListener('mouseleave', onLeave);
    canvas.addEventListener('click', onClick);
    return () => { cancelAnimationFrame(raf); canvas.removeEventListener('mousemove', onMove); canvas.removeEventListener('mouseleave', onLeave); canvas.removeEventListener('click', onClick); };
  }, [labs, onSelect]);

  return (
    <div className="globe-wrap" ref={wrap}>
      <canvas className="globe" ref={cv} width="1120" height="1120" aria-label="Rotating globe of monitored facilities" />
      <div className="globe-cap">each point = one monitored facility · hover to identify</div>
      {tip && (
        <div className="globe-tip on" style={{ position: 'fixed', left: tip.x, top: tip.y }}>
          {tip.name}<span className="v">{tip.v == null ? '· no history' : '· ' + Math.round(tip.v)}</span>
        </div>
      )}
    </div>
  );
}
