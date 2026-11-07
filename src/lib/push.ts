import { eq } from "drizzle-orm";
import webpush from "web-push";
import { db } from "@/db";
import { notifications, profiles, pushSubscriptions } from "@/db/schema";

let configured = false;
function configure() {
  if (configured) return true;
  const pub = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const priv = process.env.VAPID_PRIVATE_KEY;
  if (!pub || !priv) return false;
  webpush.setVapidDetails("mailto:mr.spacks@seznam.cz", pub, priv);
  configured = true;
  return true;
}

export type PushPayload = { title: string; body: string; url?: string; tag?: string; sticky?: boolean };

/**
 * Уведомить пользователя: запись в центр уведомлений приложения (store) + push на все его устройства.
 * Мёртвые push-подписки удаляются. Возвращает число отправленных push.
 */
export async function sendPushToUser(
  userId: string,
  build: (locale: string) => PushPayload,
  opts: { store?: boolean } = {},
) {
  const store = opts.store ?? true;
  const subs = await db.select().from(pushSubscriptions).where(eq(pushSubscriptions.userId, userId));

  if (store) {
    const [p] = await db.select({ locale: profiles.locale }).from(profiles).where(eq(profiles.userId, userId)).limit(1);
    const msg = build(p?.locale ?? subs[0]?.locale ?? "en");
    await db.insert(notifications).values({ userId, title: msg.title, body: msg.body, url: msg.url ?? "/" });
  }

  if (!configure()) return 0;
  let sent = 0;
  for (const s of subs) {
    try {
      await webpush.sendNotification(
        { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
        JSON.stringify(build(s.locale)),
        { TTL: 60 * 60 * 12 },
      );
      sent++;
    } catch (e) {
      const code = (e as { statusCode?: number }).statusCode;
      if (code === 404 || code === 410) await db.delete(pushSubscriptions).where(eq(pushSubscriptions.id, s.id));
    }
  }
  return sent;
}
