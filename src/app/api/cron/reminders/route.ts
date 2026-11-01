import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { pushSubscriptions, reminderLog } from "@/db/schema";
import { DICTIONARIES, INTL_LOCALE, isLocale } from "@/i18n/dictionaries";
import { formatMoney, todayISO } from "@/lib/forecast";
import { sendPushToUser } from "@/lib/push";
import { getReminders } from "@/lib/reminders";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/** Раз в день (Vercel Cron): каждому с подписками — одно сводное уведомление, если есть что напомнить. */
export async function GET(req: Request) {
  if (req.headers.get("authorization") !== `Bearer ${process.env.CRON_SECRET}`) {
    return new Response("Unauthorized", { status: 401 });
  }
  const today = todayISO();
  const users = [...new Set((await db.select({ u: pushSubscriptions.userId }).from(pushSubscriptions)).map((r) => r.u))];
  let notified = 0;

  for (const userId of users) {
    const [done] = await db
      .select()
      .from(reminderLog)
      .where(and(eq(reminderLog.userId, userId), eq(reminderLog.day, today)))
      .limit(1);
    if (done) continue;

    // Платежи — за 3 дня и просроченные; события — за 2 дня.
    const list = await getReminders(userId, today, 3, 2);
    if (list.length === 0) continue;

    const sent = await sendPushToUser(userId, (loc) => {
      const lang = isLocale(loc) ? loc : "en";
      const t = DICTIONARIES[lang].rm;
      const lines = list.slice(0, 4).map((r) => {
        const label = r.kind === "overdue" ? t.overdue : r.kind === "due" ? t.due : t.event;
        const amount = r.amount != null ? ` — ${formatMoney(r.amount, r.currency, INTL_LOCALE[lang])}` : "";
        return `${label} ${t.when(r.days)}: ${r.title}${amount}`;
      });
      if (list.length > 4) lines.push(`… ${t.pushSummary(list.length)}`);
      return { title: t.title, body: lines.join("\n"), url: "/", tag: `daily-${today}` };
    });

    if (sent > 0) {
      await db.insert(reminderLog).values({ userId, day: today }).onConflictDoNothing();
      notified++;
    }
  }
  return Response.json({ ok: true, users: users.length, notified });
}
