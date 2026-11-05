"use client";

import { useEffect } from "react";
import { usePathname, useSearchParams } from "next/navigation";

const WARM_KEY = "cfp-warm-at";

async function post(msg: unknown) {
  if (!("serviceWorker" in navigator)) return;
  const reg = await navigator.serviceWorker.ready;
  (navigator.serviceWorker.controller ?? reg.active)?.postMessage(msg);
}

export default function RegisterSW({ loggedIn }: { loggedIn: boolean }) {
  const pathname = usePathname();
  const search = useSearchParams();

  // Регистрация + прогрев главных экранов (не чаще раза в 3 часа), очистка после выхода.
  useEffect(() => {
    if (!("serviceWorker" in navigator) || process.env.NODE_ENV !== "production") return;
    navigator.serviceWorker
      .register("/sw.js")
      .then(async () => {
        if (!loggedIn) {
          // Вышли из аккаунта — удаляем сохранённые страницы с личными данными.
          const keys = await caches.keys();
          await Promise.all(keys.filter((k) => k.startsWith("cfp-")).map((k) => caches.delete(k)));
          localStorage.removeItem(WARM_KEY);
          return;
        }
        if (!navigator.onLine) return;
        const last = Number(localStorage.getItem(WARM_KEY) ?? 0);
        if (Date.now() - last < 3 * 3600 * 1000) return;
        await post({ type: "warm" });
        localStorage.setItem(WARM_KEY, String(Date.now()));
      })
      .catch(() => {});
  }, [loggedIn]);

  // Каждый открытый экран тоже сохраняем на телефоне (если его там ещё нет).
  useEffect(() => {
    if (!loggedIn || process.env.NODE_ENV !== "production" || !navigator.onLine) return;
    const qs = search.toString();
    const url = qs ? `${pathname}?${qs}` : pathname;
    if (/^\/(login|register|invite|join|notifications\/)/.test(url)) return;
    const t = setTimeout(() => void post({ type: "warm", urls: [url], onlyMissing: true }).catch(() => {}), 1500);
    return () => clearTimeout(t);
  }, [pathname, search, loggedIn]);

  return null;
}
