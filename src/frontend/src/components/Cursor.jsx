import { useEffect, useRef } from 'react';

// A single, sleek custom dot cursor that scales smoothly over interactive elements.
export default function Cursor() {
  const dot = useRef(null);

  useEffect(() => {
    const fine = matchMedia('(hover:hover) and (pointer:fine)').matches;
    if (!fine) return;

    let mx = innerWidth / 2, my = innerHeight / 2;
    let dx = mx, dy = my;
    let raf;

    const onMove = (e) => {
      mx = e.clientX; my = e.clientY;
      const hot = e.target.closest?.('a,button,[data-cursor],input');
      if (dot.current) {
        if (hot) dot.current.classList.add('hot');
        else dot.current.classList.remove('hot');
      }
    };
    
    // Smooth trailing effect for the dot itself to make it feel organic
    const tick = () => {
      dx += (mx - dx) * 0.4;
      dy += (my - dy) * 0.4;
      if (dot.current) dot.current.style.transform = `translate(${dx}px,${dy}px) translate(-50%,-50%)`;
      raf = requestAnimationFrame(tick);
    };

    window.addEventListener('mousemove', onMove);
    tick();
    return () => { window.removeEventListener('mousemove', onMove); cancelAnimationFrame(raf); };
  }, []);

  return <div ref={dot} className="cur-dot" aria-hidden="true" />;
}
