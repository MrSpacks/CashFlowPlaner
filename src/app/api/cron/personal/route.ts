import { and, eq, isNull } from "drizzle-orm";
import { db } from "@/db";
import { dailyPlans, personalReminderSends } from "@/db/schema";
import { canUseDailyPlan, plansToNotify } from "@/lib/dailyPlan";
import { DICTIONARIES, isLocale } from "@/i18n/dictionaries";
import { dueReminderSlots } from "@/lib/personalReminders";
import { sendPushToUser } from "@/lib/push";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * Каждые несколько минут: отправить личные напоминания, время которых наступило.
 * Безопасно вызывать сколько угодно раз — каждое напоминание уходит один раз (slot в базе).
 */
export async function GET() {
  const due = await dueReminderSlots();
  let sent = 0;
  for (const d of due) {
    const [fresh] = await db
      .insert(personalReminderSends)
      .values({ reminderId: d.reminder.id, slot: d.slot })
      .onConflictDoNothing()
      .returning({ slot: personalReminderSends.slot });
    if (!fresh) continue;
    await sendPushToUser(
      d.reminder.ownerId,
      (loc) => ({
        title: `⏰ ${d.reminder.title}`,
        body: DICTIONARIES[isLocale(loc) ? loc : "en"].prm.pushBody(d.time),
        url: "/",
        tag: `prm-${d.reminder.id}`,
        sticky: true,
      }),
      { store: false },
    );
    sent++;
  }

  // План дня: о новом плане — один push (тот же 5-минутный пинг).
  let plans = 0;
  for (const p of await plansToNotify()) {
    const [claimed] = await db
      .update(dailyPlans)
      .set({ notifiedAt: new Date() })
      .where(and(eq(dailyPlans.id, p.id), isNull(dailyPlans.notifiedAt)))
      .returning({ id: dailyPlans.id });
    if (!claimed || !canUseDailyPlan(p.ownerId)) continue;
    await sendPushToUser(
      p.ownerId,
      (loc) => {
        const t = DICTIONARIES[isLocale(loc) ? loc : "en"].dp;
        return {
          title: t.pushTitle,
          body: [p.headline, p.focus].filter(Boolean).join(" — ") || t.title,
          url: "/plan",
          tag: `dp-${p.date}`,
        };
      },
      { store: false },
    );
    plans++;
  }
  return Response.json({ due: due.length, sent, plans });
}
