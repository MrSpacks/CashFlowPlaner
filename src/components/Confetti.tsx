"use client";

import { useEffect, useRef } from "react";

/**
 * Конфетти — один раз на ключ (например, «план 2026-11-24 выполнен»), повторно не сыплется.
 * Без библиотек: ~120 частиц на canvas, 2,5 секунды.
 */
export default function Confetti({ onceKey }: { onceKey: string }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const storeKey = `cfp-confetti:${onceKey}`;
    try {
      if (localStorage.getItem(storeKey)) return;
      localStorage.setItem(storeKey, "1");
    } catch {}
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const c = ref.current;
    if (!c) return;
    const ctx = c.getContext("2d")!;
    const dpr = window.devicePixelRatio || 1;
    c.width = innerWidth * dpr;
    c.height = innerHeight * dpr;
    ctx.scale(dpr, dpr);
    const colors = ["#10b981", "#34d399", "#f59e0b", "#3b82f6", "#ec4899", "#a855f7"];
    const ps = Array.from({ length: 120 }, () => ({
      x: innerWidth / 2 + (Math.random() - 0.5) * 80,
      y: innerHeight * 0.35,
      vx: (Math.random() - 0.5) * 12,
      vy: -Math.random() * 12 - 4,
      r: Math.random() * Math.PI,
      vr: (Math.random() - 0.5) * 0.3,
      w: 6 + Math.random() * 6,
      h: 3 + Math.random() * 4,
      col: colors[(Math.random() * colors.length) | 0],
    }));
    const t0 = performance.now();
    let raf = 0;
    const tick = (t: number) => {
      const el = t - t0;
      ctx.clearRect(0, 0, innerWidth, innerHeight);
      ctx.globalAlpha = el > 1800 ? Math.max(0, 1 - (el - 1800) / 700) : 1;
      for (const p of ps) {
        p.vy += 0.35;
        p.vx *= 0.99;
        p.x += p.vx;
        p.y += p.vy;
        p.r += p.vr;
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(p.r);
        ctx.fillStyle = p.col;
        ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
        ctx.restore();
      }
      if (el < 2500) raf = requestAnimationFrame(tick);
      else ctx.clearRect(0, 0, innerWidth, innerHeight);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [onceKey]);
  return <canvas ref={ref} className="cfp-confetti" aria-hidden="true" />;
}
