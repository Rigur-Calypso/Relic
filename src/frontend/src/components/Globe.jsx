import { useEffect, useRef, useState } from 'react';
import { latLngOf } from '../geo.js';
import { geoOrthographic, geoPath } from 'd3-geo';

const bandColor = (v) => v == null ? '#C9CEE0' : v >= 90 ? '#12B26B' : v >= 60 ? '#E8990C' : '#F0435A';

export default function Globe({ labs, onSelect }) {
  const cv = useRef(null);
  const wrap = useRef(null);
  const [tip, setTip] = useState(null); // { name, v, x, y }

  useEffect(() => {
    const canvas = cv.current; if (!canvas || !labs.length) return;
    const ctx = canvas.getContext('2d');
    const W = canvas.width, H = canvas.height, R = W * 0.42;
    const reduce = matchMedia('(prefers-reduced-motion:reduce)').matches;

    // d3-geo expects [longitude, latitude]
    const pts = labs.map((l) => {
      const [lat, lng] = latLngOf(l);
      return { coords: [lng, lat], color: bandColor(l.vitalityScore), lab: l };
    });

    // Mathematically perfect orthographic globe
    const projection = geoOrthographic()
      .scale(R)
      .translate([W / 2, H / 2])
      .clipAngle(90); // This perfectly culls the back hemisphere!

    const path = geoPath(projection, ctx);

    let yaw = -20, pitch = -15, targetSpin = 0, mouseNX = 0, hover = -1, raf;
    let projPts = [];

    function frame() {
      ctx.clearRect(0, 0, W, H);
      
      // Update the perfect 3D rotation
      projection.rotate([yaw, pitch, 0]);

      // Calculate projected positions
      projPts = [];
      for (let i = 0; i < pts.length; i++) {
        const p = pts[i];
        const xy = projection(p.coords);
        // projection returns null if the point is hidden on the back of the globe
        if (xy) projPts.push({ x: xy[0], y: xy[1], ...p, originalIndex: i });
      }

      // Draw a sleek sphere outline
      ctx.beginPath();
      path({type: "Sphere"});
      ctx.fillStyle = "rgba(120,140,255,0.03)";
      ctx.fill();
      ctx.lineWidth = 1;
      ctx.strokeStyle = "rgba(120,140,255,0.15)";
      ctx.stroke();

      // Draw front-facing points
      for (const q of projPts) {
        const isH = q.originalIndex === hover;
        const rad = isH ? 8 : 4;
        
        ctx.fillStyle = q.color;
        ctx.beginPath();
        ctx.arc(q.x, q.y, rad, 0, 7);
        ctx.fill();
        
        if (isH) {
          ctx.strokeStyle = '#fff';
          ctx.lineWidth = 2.5;
          ctx.stroke();
          ctx.shadowColor = q.color;
          ctx.shadowBlur = 12;
          ctx.fill();
          ctx.shadowBlur = 0;
        }
      }

      if (!reduce) yaw -= 0.08 + targetSpin * 0.2 + mouseNX * 0.05;
      raf = requestAnimationFrame(frame);
    }
    frame();

    function toInternal(e) {
      const r = canvas.getBoundingClientRect();
      return { ix: (e.clientX - r.left) / r.width * W, iy: (e.clientY - r.top) / r.height * H, r };
    }

    function onMove(e) {
      const { ix, iy, r } = toInternal(e);
      mouseNX = ((e.clientX - r.left) / r.width - 0.5) * 2;
      
      let best = -1, bd = 20 * 20;
      for (const q of projPts) {
        const dx = q.x - ix, dy = q.y - iy, d = dx * dx + dy * dy;
        if (d < bd) { bd = d; best = q.originalIndex; }
      }
      
      hover = best;
      if (best >= 0) {
        const l = pts[best].lab;
        const q = projPts.find(p => p.originalIndex === best);
        setTip({ name: l.name, v: l.vitalityScore, x: r.left + (q.x / W) * r.width, y: r.top + (q.y / H) * r.height });
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
