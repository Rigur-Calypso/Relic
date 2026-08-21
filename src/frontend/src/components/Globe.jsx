import { useEffect, useRef, useState } from 'react';
import { latLngOf } from '../geo.js';
import { geoOrthographic, geoPath } from 'd3-geo';

const bandColor = (v) => v == null ? '#C9CEE0' : v >= 90 ? '#12B26B' : v >= 60 ? '#E8990C' : '#F0435A';

export default function Globe({ labs, onSelect }) {
  const cv = useRef(null);
  const wrap = useRef(null);
  const [tip, setTip] = useState(null);

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

    // Mathematically perfect orthographic projection
    const projection = geoOrthographic()
      .scale(R)
      .translate([W / 2, H / 2])
      .clipAngle(90);

    const path = geoPath(projection, ctx);

    let yaw = -20, pitch = -15, hover = -1, raf;
    let projPts = [];
    let autoSpin = true;

    // ── Drag rotation state ──
    let dragging = false, dragStartX = 0, dragStartY = 0;
    let yawAtDragStart = 0, pitchAtDragStart = 0;
    let dragMoved = false;

    function frame() {
      ctx.clearRect(0, 0, W, H);
      projection.rotate([yaw, pitch, 0]);

      // Project all points
      projPts = [];
      for (let i = 0; i < pts.length; i++) {
        const p = pts[i];
        const xy = projection(p.coords);
        if (xy) projPts.push({ x: xy[0], y: xy[1], ...p, originalIndex: i });
      }

      // Draw subtle graticule-like sphere outline
      ctx.beginPath();
      path({ type: 'Sphere' });
      ctx.fillStyle = 'rgba(120,140,255,0.03)';
      ctx.fill();
      ctx.lineWidth = 1.2;
      ctx.strokeStyle = 'rgba(120,140,255,0.12)';
      ctx.stroke();

      // Draw visible points (front hemisphere only — d3 handles culling)
      for (const q of projPts) {
        const isH = q.originalIndex === hover;
        const rad = isH ? 9 : 4.5;

        // Glow
        if (isH) {
          ctx.save();
          ctx.shadowColor = q.color;
          ctx.shadowBlur = 18;
          ctx.fillStyle = q.color;
          ctx.beginPath();
          ctx.arc(q.x, q.y, rad + 4, 0, Math.PI * 2);
          ctx.fill();
          ctx.restore();
        }

        // Dot
        ctx.globalAlpha = isH ? 1 : 0.85;
        ctx.fillStyle = q.color;
        ctx.beginPath();
        ctx.arc(q.x, q.y, rad, 0, Math.PI * 2);
        ctx.fill();

        if (isH) {
          ctx.strokeStyle = '#fff';
          ctx.lineWidth = 2.5;
          ctx.stroke();
        }
        ctx.globalAlpha = 1;
      }

      // Auto-spin only when not dragging
      if (!reduce && autoSpin && !dragging) {
        yaw -= 0.06;
      }

      raf = requestAnimationFrame(frame);
    }
    frame();

    // ── Coordinate conversion ──
    function toInternal(e) {
      const r = canvas.getBoundingClientRect();
      return { ix: (e.clientX - r.left) / r.width * W, iy: (e.clientY - r.top) / r.height * H, r };
    }

    // ── Drag handlers ──
    function onPointerDown(e) {
      dragging = true;
      dragMoved = false;
      dragStartX = e.clientX;
      dragStartY = e.clientY;
      yawAtDragStart = yaw;
      pitchAtDragStart = pitch;
      autoSpin = false;
      canvas.setPointerCapture(e.pointerId);
      canvas.style.cursor = 'grabbing';
    }

    function onPointerMove(e) {
      if (dragging) {
        const dx = e.clientX - dragStartX;
        const dy = e.clientY - dragStartY;
        if (Math.abs(dx) > 3 || Math.abs(dy) > 3) dragMoved = true;
        // Scale: 1 pixel of drag = 0.3 degrees of rotation
        yaw = yawAtDragStart + dx * 0.3;
        pitch = Math.max(-80, Math.min(80, pitchAtDragStart - dy * 0.3));
        setTip(null);
        hover = -1;
        return;
      }

      // Hovering (not dragging)
      const { ix, iy, r } = toInternal(e);
      let best = -1, bd = 22 * 22;
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
      } else {
        setTip(null);
        canvas.style.cursor = 'grab';
      }
    }

    function onPointerUp(e) {
      if (dragging && !dragMoved && hover >= 0 && onSelect) {
        // This was a click, not a drag — select the lab
        onSelect(pts[hover].lab);
      }
      dragging = false;
      canvas.style.cursor = 'grab';
      // Resume auto-spin after 3 seconds of inactivity
      setTimeout(() => { if (!dragging) autoSpin = true; }, 3000);
    }

    function onPointerLeave() {
      dragging = false;
      hover = -1;
      setTip(null);
      canvas.style.cursor = 'grab';
    }

    // Click handler only fires for non-drag clicks on dots
    function onClick(e) {
      if (dragMoved) return; // Ignore if this was a drag
      const { ix, iy } = toInternal(e);
      let best = -1, bd = 22 * 22;
      for (const q of projPts) {
        const dx = q.x - ix, dy = q.y - iy, d = dx * dx + dy * dy;
        if (d < bd) { bd = d; best = q.originalIndex; }
      }
      if (best >= 0 && onSelect) onSelect(pts[best].lab);
    }

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
  }, [labs, onSelect]);

  return (
    <div className="globe-wrap" ref={wrap}>
      <canvas className="globe" ref={cv} width="1120" height="1120" aria-label="Rotating globe of monitored facilities" />
      <div className="globe-cap">drag to rotate · hover to identify · click a dot to jump</div>
      {tip && (
        <div className="globe-tip on" style={{ position: 'fixed', left: tip.x, top: tip.y }}>
          {tip.name}<span className="v">{tip.v == null ? '· no history' : '· ' + Math.round(tip.v)}</span>
        </div>
      )}
    </div>
  );
}
