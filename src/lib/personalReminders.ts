import { and, desc, eq, gt, inArray, isNull } from "drizzle-orm";
import { db } from "@/db";
import { personalReminders, personalReminderSends, profiles } from "@/db/schema";

export const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;

/** Местные дата и время "HH:MM" в часовом поясе. */
export function localNow(tz: string, at = new Date()) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: tz,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(at);
  const g = (k: string) => parts.find((p) => p.type === k)?.value ?? "00";
  return { date: `${g("year")}-${g("month")}-${g("day")}`, hm: `${g("hour")}:${g("minute")}` };
}

const mins = (hm: string) => Number(hm.slice(0, 2)) * 60 + Number(hm.slice(3, 5));

/** Нормализовать список времён из формы: валидные, без повторов, по порядку, не больше 8. */
export function cleanTimes(values: FormDataEntryValue[]) {
  return [...new Set(values.map((v) => String(v).trim()).filter((v) => TIME_RE.test(v)))].sort().slice(0, 8);
}

export async function listPersonalReminders(userId: string) {
  return db.select().from(personalReminders).where(eq(personalReminders.ownerId, userId)).orderBy(personalReminders.createdAt);
}

/** Какие напоминания пора отправить сейчас (окно 60 мин после времени, каждое — один раз). */
export async function dueReminderSlots(at = new Date()) {
  const rows = await db
    .select({ r: personalReminders, tz: profiles.timezone })
    .from(personalReminders)
    .leftJoin(profiles, eq(profiles.userId, personalReminders.ownerId))
    .where(eq(personalReminders.enabled, true));
  const due: { reminder: typeof personalReminders.$inferSelect; slot: string; time: string }[] = [];
  for (const { r, tz } of rows) {
    const now = localNow(tz ?? "Europe/Prague", at);
    for (const t of r.times) {
      const diff = mins(now.hm) - mins(t);
      if (diff >= 0 && diff < 60) due.push({ reminder: r, slot: `${now.date} ${t}`, time: t });
    }
  }
  return due;
}

/** Невыполненные напоминания за последние 12 часов — для красной плашки в приложении. */
export async function pendingReminders(userId: string) {
  const since = new Date(Date.now() - 12 * 3600 * 1000);
  const mine = await listPersonalReminders(userId);
  if (mine.length === 0) return [];
  const sends = await db
    .select()
    .from(personalReminderSends)
    .where(
      and(
        inArray(personalReminderSends.reminderId, mine.map((m) => m.id)),
        isNull(personalReminderSends.doneAt),
        gt(personalReminderSends.sentAt, since),
      ),
    )
    .orderBy(desc(personalReminderSends.sentAt));
  return sends.map((s) => ({ ...s, title: mine.find((m) => m.id === s.reminderId)?.title ?? "" }));
}
