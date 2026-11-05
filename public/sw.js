// Простой service worker: делает приложение устанавливаемым и
// показывает последние открытые страницы без интернета.
const CACHE = "cfp-v4";
const OFFLINE_HTML = `<!doctype html><html lang="ru"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Offline</title><body style="font-family:system-ui;background:#f8fafc;color:#0f172a;display:grid;place-items:center;min-height:100vh;margin:0;text-align:center;padding:24px">
<div><div style="font-size:48px">📴</div><h1 style="font-size:20px">Нет интернета · Offline</h1>
<p style="color:#64748b">Эта страница ещё не сохранена на телефоне. Откройте её один раз с интернетом.</p>
<p><a href="/" style="color:#059669">← CashFlowPlaner</a></p></div></body></html>`;

self.addEventListener("install", () => self.skipWaiting());

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))),
  );
  self.clients.claim();
});

// Прогрев: приложение присылает список главных экранов — сохраняем их для работы без сети.
self.addEventListener("message", (event) => {
  if (event.data?.type !== "warm" || !Array.isArray(event.data.urls)) return;
  event.waitUntil(
    caches.open(CACHE).then((c) =>
      Promise.all(
        event.data.urls.map((u) =>
          fetch(u, { credentials: "same-origin" })
            .then((res) => {
              if (res.ok && !res.redirected) return c.put(u, res);
            })
            .catch(() => {}),
        ),
      ),
    ),
  );
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
          return (
            (await c.match(url.pathname + url.search)) ||
            (await c.match(url.pathname)) ||
            new Response(OFFLINE_HTML, { headers: { "content-type": "text/html; charset=utf-8" } })
          );
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
