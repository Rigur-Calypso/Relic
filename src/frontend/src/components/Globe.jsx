import { useEffect, useMemo, useRef, useState } from 'react';
import { latLngOf } from '../geo.js';
import { geoOrthographic, geoPath, geoGraticule10 } from 'd3-geo';
import { feature } from 'topojson-client';
import world from 'world-atlas/countries-110m.json';

const bandColor = (v) => v == null ? '#C9CEE0' : v >= 90 ? '#12B26B' : v >= 60 ? '#E8990C' : '#F0435A';

// Country landmasses (GeoJSON features), computed once from the bundled topojson.
const COUNTRIES = feature(world, world.objects.countries).features;
const GRATICULE = geoGraticule10();

export default function Globe({ labs, onSelect }) {
  const cv = useRef(null);
  const wrap = useRef(null);
  const [tip, setTip] = useState(null);

  // Marker points for every monitored facility (recomputed only when labs change).
  const pts = useMemo(() => labs.map((l) => {
    const [lat, lng] = latLngOf(l);
    return { coords: [lng, lat], color: bandColor(l.vitalityScore), lab: l }; // d3 wants [lng,lat]
  }), [labs]);

  useEffect(() => {
    const canvas = cv.current; if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const W = canvas.width, H = canvas.height, R = W * 0.42;
    const cx = W / 2, cy = H / 2;
    const reduce = matchMedia('(prefers-reduced-motion:reduce)').matches;

    const projection = geoOrthographic().scale(R).translate([cx, cy]).clipAngle(90);
    const path = geoPath(projection, ctx);

    // Pre-built spherical shading gradients (light source at upper-left → 3D sphere).
    const ocean = ctx.createRadialGradient(cx - R * 0.35, cy - R * 0.4, R * 0.1, cx, cy, R * 1.05);
    ocean.addColorStop(0, '#EAF1FF');
    ocean.addColorStop(0.55, '#AFC6F2');
    ocean.addColorStop(1, '#6E93DC');
    // Limb darkening + specular sheen overlaid after land for depth.
    const vignette = ctx.createRadialGradient(cx - R * 0.3, cy - R * 0.35, R * 0.15, cx, cy, R * 1.02);
    vignette.addColorStop(0, 'rgba(255,255,255,0.22)');
    vignette.addColorStop(0.5, 'rgba(60,80,140,0)');
    vignette.addColorStop(1, 'rgba(30,42,90,0.34)');

    let yaw = -20, pitch = -12, hover = -1, raf;
    let projPts = [];
    let autoSpin = true;
    let dragging = false, dragStartX = 0, dragStartY = 0, yawAtStart = 0, pitchAtStart = 0, dragMoved = false;

    function frame() {
      ctx.clearRect(0, 0, W, H);
      projection.rotate([yaw, pitch, 0]);

      // 1 — Ocean sphere (shaded for a 3D look)
      ctx.beginPath(); path({ type: 'Sphere' });
      ctx.fillStyle = ocean; ctx.fill();

      // 2 — Graticule (faint lat/lng grid)
      ctx.beginPath(); path(GRATICULE);
      ctx.strokeStyle = 'rgba(70,95,160,0.16)'; ctx.lineWidth = 0.6; ctx.stroke();

      // 3 — Country landmasses with borders
      ctx.save();
      ctx.beginPath(); path({ type: 'Sphere' }); ctx.clip();  // never paint past the limb
      for (const c of COUNTRIES) {
        ctx.beginPath(); path(c);
        ctx.fillStyle = 'rgba(247,249,255,0.92)'; ctx.fill();
        ctx.strokeStyle = 'rgba(96,116,180,0.55)'; ctx.lineWidth = 0.5; ctx.stroke();
      }
      // 4 — Spherical shading overlay (limb darkening + top-left highlight)
      ctx.beginPath(); path({ type: 'Sphere' });
      ctx.fillStyle = vignette; ctx.fill();
      ctx.restore();

      // 5 — Atmosphere rim
      ctx.beginPath(); path({ type: 'Sphere' });
      ctx.lineWidth = 2; ctx.strokeStyle = 'rgba(120,150,230,0.5)'; ctx.stroke();

      // 6 — Facility markers (front hemisphere only; d3 culls the back via clipAngle)
      projPts = [];
      for (let i = 0; i < pts.length; i++) {
        const xy = projection(pts[i].coords);
        if (xy) projPts.push({ x: xy[0], y: xy[1], ...pts[i], originalIndex: i });
      }
      for (const q of projPts) {
        const isH = q.originalIndex === hover;
        const rad = isH ? 8.5 : 4.2;
        // connector stem so a marker reads as sitting ON the surface
        ctx.globalAlpha = isH ? 1 : 0.9;
        if (isH) {
          ctx.save();
          ctx.shadowColor = q.color; ctx.shadowBlur = 20;
          ctx.fillStyle = q.color;
          ctx.beginPath(); ctx.arc(q.x, q.y, rad + 3, 0, Math.PI * 2); ctx.fill();
          ctx.restore();
        }
        ctx.fillStyle = q.color;
        ctx.beginPath(); ctx.arc(q.x, q.y, rad, 0, Math.PI * 2); ctx.fill();
        ctx.strokeStyle = 'rgba(255,255,255,0.95)'; ctx.lineWidth = isH ? 2.4 : 1.1;
        ctx.stroke();
        ctx.globalAlpha = 1;
      }

      if (!reduce && autoSpin && !dragging) yaw -= 0.06;
      raf = requestAnimationFrame(frame);
    }
    frame();

    function toInternal(e) {
      const r = canvas.getBoundingClientRect();
      return { ix: (e.clientX - r.left) / r.width * W, iy: (e.clientY - r.top) / r.height * H, r };
    }
    const hitTest = (ix, iy) => {
      let best = -1, bd = 24 * 24;
      for (const q of projPts) { const dx = q.x - ix, dy = q.y - iy, d = dx * dx + dy * dy; if (d < bd) { bd = d; best = q.originalIndex; } }
      return best;
    };

    function onPointerDown(e) {
      dragging = true; dragMoved = false;
      dragStartX = e.clientX; dragStartY = e.clientY; yawAtStart = yaw; pitchAtStart = pitch;
      autoSpin = false; canvas.setPointerCapture(e.pointerId); canvas.style.cursor = 'grabbing';
    }
    function onPointerMove(e) {
      if (dragging) {
        const dx = e.clientX - dragStartX, dy = e.clientY - dragStartY;
        if (Math.abs(dx) > 3 || Math.abs(dy) > 3) dragMoved = true;
        yaw = yawAtStart + dx * 0.3;
        pitch = Math.max(-88, Math.min(88, pitchAtStart - dy * 0.3));
        setTip(null); hover = -1; return;
      }
      const { ix, iy, r } = toInternal(e);
      const best = hitTest(ix, iy);
      hover = best;
      if (best >= 0) {
        const l = pts[best].lab; const q = projPts.find(p => p.originalIndex === best);
        setTip({ name: l.name, v: l.vitalityScore, x: r.left + (q.x / W) * r.width, y: r.top + (q.y / H) * r.height });
        canvas.style.cursor = 'pointer';
      } else { setTip(null); canvas.style.cursor = 'grab'; }
    }
    function onPointerUp() {
      if (dragging && !dragMoved && hover >= 0 && onSelect) onSelect(pts[hover].lab);
      dragging = false; canvas.style.cursor = 'grab';
      setTimeout(() => { if (!dragging) autoSpin = true; }, 3000);
    }
    function onPointerLeave() { dragging = false; hover = -1; setTip(null); canvas.style.cursor = 'grab'; }

    canvas.style.cursor = 'grab';
    canvas.addEventListener('pointerdown', onPointerDown);
    canvas.addEventListener('pointermove', onPointerMove);
    canvas.addEventListener('pointerup', onPointerUp);
    canvas.addEventListener('pointerleave', onPointerLeave);
    return () => {
      cancelAnimationFrame(raf);
      canvas.removeEventListener('pointerdown', onPointerDown);
      canvas.removeEventListener('pointermove', onPointerMove);
      canvas.removeEventListener('pointerup', onPointerUp);
      canvas.removeEventListener('pointerleave', onPointerLeave);
    };
  }, [pts, onSelect]);

  return (
    <div className="globe-wrap" ref={wrap}>
      <canvas className="globe" ref={cv} width="1120" height="1120" aria-label="Rotating 3D globe of monitored facilities" />
      <div className="globe-cap">drag to rotate · hover to identify · click a dot to open its report</div>
      {tip && (
        <div className="globe-tip on" style={{ position: 'fixed', left: tip.x, top: tip.y }}>
          {tip.name}<span className="v">{tip.v == null ? '· no history' : '· ' + Math.round(tip.v)}</span>
        </div>
      )}
    </div>
  );
}
