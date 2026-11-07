import { db } from "@/db";
import { personalReminderSends } from "@/db/schema";
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
  return Response.json({ due: due.length, sent });
}
