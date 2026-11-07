// Service worker CashFlowPlaner: установка как приложение, работа без интернета, push-уведомления.
const CACHE = "cfp-v6";
// Главные экраны — сохраняем при запуске service worker'а (если пользователь вошёл).
const WARM = ["/", "/calendar", "/events", "/events/new", "/ideas", "/more", "/more/reminders", "/notifications", "/chats", "/people", "/profile"];
const LABELS = {
  "/": "📊 Přehled / Прогноз",
  "/calendar": "📅 Kalendář / Календарь",
  "/events": "🗂 Události / События",
  "/events/new": "＋ Nová událost / Новое событие",
  "/ideas": "💡 Nápady / Идеи",
  "/more": "⋯ Další / Ещё",
  "/notifications": "🔔 Oznámení / Уведомления",
  "/chats": "💬 Chaty / Чаты",
  "/people": "👥 Lidé / Люди",
  "/profile": "👤 Profil / Профиль",
};

/** Сохранить страницы (only missing — только те, которых ещё нет). Перенаправления (на вход) не сохраняем. */
async function warm(urls, onlyMissing) {
  const c = await caches.open(CACHE);
  await Promise.all(
    urls.map(async (u) => {
      try {
        if (onlyMissing && (await c.match(u))) return;
        const res = await fetch(u, { credentials: "same-origin" });
        if (res.ok && !res.redirected && (res.headers.get("content-type") || "").includes("text/html")) await c.put(u, res);
      } catch {}
    }),
  );
}

/** Страница «нет интернета»: кнопка назад + список того, что уже есть на телефоне. */
async function offlinePage() {
  const c = await caches.open(CACHE);
  const keys = (await c.keys())
    .map((r) => new URL(r.url).pathname + new URL(r.url).search)
    .filter((p) => !p.startsWith("/_next/") && !p.startsWith("/icons/"));
  const uniq = [...new Set(keys)].sort((x, y) => (LABELS[x] ? 0 : 1) - (LABELS[y] ? 0 : 1) || x.localeCompare(y));
  const links = uniq
    .map((p) => `<a href="${p}" style="display:block;padding:12px 14px;margin:6px 0;background:#fff;border-radius:12px;color:#0f172a;text-decoration:none;border:1px solid #e2e8f0">${LABELS[p] || p}</a>`)
    .join("");
  const html = `<!doctype html><html lang="ru"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<title>Offline</title><body style="font-family:system-ui;background:#f8fafc;color:#0f172a;margin:0;padding:calc(24px + env(safe-area-inset-top)) 20px 32px">
<button onclick="history.length>1?history.back():location.assign('/')" style="font:inherit;font-size:16px;color:#059669;background:none;border:0;padding:8px 0;margin-bottom:8px">← Zpět / Назад</button>
<div style="text-align:center"><div style="font-size:44px">📴</div><h1 style="font-size:20px;margin:8px 0">Nejste online · Нет интернета</h1>
<p style="color:#64748b;margin:0 0 16px">Tato stránka není uložená v telefonu. · Эта страница ещё не сохранена на телефоне.</p></div>
${links ? `<p style="color:#64748b;font-size:13px;margin:16px 0 4px">Uloženo v telefonu · Сохранено на телефоне:</p>${links}` : ""}
</body></html>`;
  return new Response(html, { headers: { "content-type": "text/html; charset=utf-8" } });
}

self.addEventListener("install", () => self.skipWaiting());

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
      .then(() => warm(WARM, true)),
  );
});

// Приложение просит сохранить страницы: главные экраны или только что открытый экран.
self.addEventListener("message", (event) => {
  const d = event.data || {};
  if (d.type === "warm") event.waitUntil(warm(Array.isArray(d.urls) ? d.urls : WARM, !!d.onlyMissing));
  if (d.type === "clear") event.waitUntil(caches.delete(CACHE));
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin || url.pathname.startsWith("/api/")) return;
  // Данные переходов внутри приложения (RSC) не кэшируем — при отсутствии сети
  // Next сам откроет страницу целиком, и её отдаст кэш ниже.
  if (req.headers.get("RSC") === "1" || url.searchParams.has("_rsc")) return;

  const isPage = req.mode === "navigate";
  const isStatic = url.pathname.startsWith("/_next/static/") || url.pathname.startsWith("/icons/");

  // Статика неизменна — сначала кэш.
  if (isStatic) {
    event.respondWith(
      caches.match(req).then(
        (hit) =>
          hit ||
          fetch(req).then((res) => {
            if (res.ok) caches.open(CACHE).then((c) => c.put(req, res.clone()));
            return res;
          }),
      ),
    );
    return;
  }

  // Страницы — сначала сеть (свежие данные), без сети — сохранённая копия.
  if (isPage) {
    event.respondWith(
      fetch(req)
        .then((res) => {
          if (res.ok && !res.redirected) {
            const copy = res.clone();
            caches.open(CACHE).then((c) => c.put(url.pathname + url.search, copy));
          }
          return res;
        })
        .catch(async () => {
          const c = await caches.open(CACHE);
          return (await c.match(url.pathname + url.search)) || (await c.match(url.pathname)) || offlinePage();
        }),
    );
  }
});

// ---------- push-уведомления ----------
self.addEventListener("push", (event) => {
  let data = { title: "CashFlowPlaner", body: "", url: "/" };
  try {
    data = { ...data, ...event.data.json() };
  } catch {
    if (event.data) data.body = event.data.text();
  }
  event.waitUntil(
    self.registration.showNotification(data.title, {
      body: data.body,
      icon: "/icons/icon-192.png",
      badge: "/icons/icon-192.png",
      tag: data.tag,
      // Важные (лекарства) — не исчезают сами, вибрируют и звучат снова при повторе.
      requireInteraction: !!data.sticky,
      renotify: !!data.sticky && !!data.tag,
      vibrate: data.sticky ? [300, 150, 300, 150, 300] : undefined,
      data: { url: data.url || "/" },
    }),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = new URL(event.notification.data?.url || "/", self.location.origin).href;
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((list) => {
      for (const c of list) {
        if ("focus" in c) {
          c.navigate(url);
          return c.focus();
        }
      }
      return self.clients.openWindow(url);
    }),
  );
});
