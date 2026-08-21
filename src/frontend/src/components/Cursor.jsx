import { useEffect, useRef } from 'react';

// A two-part cursor: a precise dot + a springy ring that lags behind and
// swells over interactive elements. Disabled on touch / reduced-motion.
export default function Cursor() {
  const dot = useRef(null);
  const ring = useRef(null);

  useEffect(() => {
    const fine = matchMedia('(hover:hover) and (pointer:fine)').matches;
    const reduce = matchMedia('(prefers-reduced-motion:reduce)').matches;
    if (!fine) return;

    let mx = innerWidth / 2, my = innerHeight / 2;   // mouse
    let rx = mx, ry = my;                             // ring (lagged)
    let raf;

    const onMove = (e) => {
      mx = e.clientX; my = e.clientY;
      if (dot.current) dot.current.style.transform = `translate(${mx}px,${my}px) translate(-50%,-50%)`;
      const hot = e.target.closest?.('a,button,[data-cursor],input');
      ring.current?.classList.toggle('hot', !!hot);
    };
    const tick = () => {
      rx += (mx - rx) * 0.18; ry += (my - ry) * 0.18;
      if (ring.current) ring.current.style.transform = `translate(${rx}px,${ry}px) translate(-50%,-50%)`;
      raf = requestAnimationFrame(tick);
    };
    window.addEventListener('mousemove', onMove);
    if (reduce) { // no spring — ring tracks exactly
      const exact = () => { if (ring.current) ring.current.style.transform = `translate(${mx}px,${my}px) translate(-50%,-50%)`; };
      window.addEventListener('mousemove', exact);
      return () => { window.removeEventListener('mousemove', onMove); window.removeEventListener('mousemove', exact); };
    }
    tick();
    return () => { window.removeEventListener('mousemove', onMove); cancelAnimationFrame(raf); };
  }, []);

  return (<>
    <div ref={ring} className="cur-ring" aria-hidden="true" />
    <div ref={dot} className="cur-dot" aria-hidden="true" />
  </>);
}
