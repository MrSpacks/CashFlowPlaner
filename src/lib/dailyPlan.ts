import { and, desc, eq, gt, isNull, lte } from "drizzle-orm";
import { db } from "@/db";
import { dailyPlans, profiles } from "@/db/schema";
import { localNow } from "@/lib/personalReminders";

/**
 * «План дня» — личная функция владельца приложения, не для всех пользователей.
 * Список id задаётся в DAILY_PLAN_USER_IDS (через запятую); по умолчанию — только владелец.
 */
const DEFAULT_OWNERS = ["Oku3jXJiTlMJmVMh9Oqal4hj1Kq8FoKb"];

export function canUseDailyPlan(userId: string | null | undefined) {
  if (!userId) return false;
  const env = process.env.DAILY_PLAN_USER_IDS;
  const ids = env ? env.split(",").map((s) => s.trim()).filter(Boolean) : DEFAULT_OWNERS;
  return ids.includes(userId);
}

export const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

/** Сегодняшняя дата в часовом поясе пользователя. */
export async function userToday(userId: string) {
  const [p] = await db.select({ tz: profiles.timezone }).from(profiles).where(eq(profiles.userId, userId)).limit(1);
  return localNow(p?.tz ?? "Europe/Prague").date;
}

export async function getDailyPlan(userId: string, date: string) {
  const [row] = await db
    .select()
    .from(dailyPlans)
    .where(and(eq(dailyPlans.ownerId, userId), eq(dailyPlans.date, date)))
    .limit(1);
  return row ?? null;
}

/** Последние планы (новые сверху), не позже даты. */
export async function recentDailyPlans(userId: string, upTo: string, limit = 14) {
  return db
    .select()
    .from(dailyPlans)
    .where(and(eq(dailyPlans.ownerId, userId), lte(dailyPlans.date, upTo)))
    .orderBy(desc(dailyPlans.date))
    .limit(limit);
}

export function planProgress(plan: { tasks: { id: string }[]; done: Record<string, boolean> }) {
  const total = plan.tasks.length;
  const done = plan.tasks.filter((t) => plan.done?.[t.id]).length;
  return { total, done };
}

/** Новые планы за последние 12 часов, о которых ещё не было push. */
export async function plansToNotify() {
  const since = new Date(Date.now() - 12 * 3600 * 1000);
  return db
    .select()
    .from(dailyPlans)
    .where(and(isNull(dailyPlans.notifiedAt), gt(dailyPlans.generatedAt, since)));
}
