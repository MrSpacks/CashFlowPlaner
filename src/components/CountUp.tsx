"use client";

import { useEffect, useRef, useState } from "react";

/** Число «набегает» от 0 до значения (0,8 с). Формат — как у formatMoney. */
export default function CountUp({ value, currency, locale }: { value: number; currency: string; locale: string }) {
  const [v, setV] = useState(value);
  const started = useRef(false);
  useEffect(() => {
    if (started.current) {
      setV(value);
      return;
    }
    started.current = true;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const t0 = performance.now();
    let raf = 0;
    const step = (t: number) => {
      const p = Math.min(1, (t - t0) / 800);
      const e = 1 - Math.pow(1 - p, 3);
      setV(value * e);
      if (p < 1) raf = requestAnimationFrame(step);
    };
    setV(0);
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [value]);
  let text: string;
  try {
    text = new Intl.NumberFormat(locale, { style: "currency", currency, maximumFractionDigits: 0 }).format(v);
  } catch {
    text = `${Math.round(v)} ${currency}`;
  }
  return <span className="tabular-nums">{text}</span>;
}
