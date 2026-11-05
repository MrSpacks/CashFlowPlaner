"use client";

import { useEffect } from "react";

// Главные экраны, которые должны открываться без интернета.
const WARM = ["/", "/calendar", "/events", "/events/new", "/ideas", "/more", "/notifications", "/chats"];
const WARM_KEY = "cfp-warm-at";

export default function RegisterSW({ loggedIn }: { loggedIn: boolean }) {
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
        // Прогреваем не чаще раза в 3 часа.
        const last = Number(localStorage.getItem(WARM_KEY) ?? 0);
        if (Date.now() - last < 3 * 3600 * 1000) return;
        const reg = await navigator.serviceWorker.ready;
        reg.active?.postMessage({ type: "warm", urls: WARM });
        localStorage.setItem(WARM_KEY, String(Date.now()));
      })
      .catch(() => {});
  }, [loggedIn]);
  return null;
}
