import { and, desc, eq, gt, inArray, isNull, lte } from "drizzle-orm";
import { db } from "@/db";
import { dailyPlans, profiles } from "@/db/schema";
import { localNow } from "@/lib/personalReminders";

/**
 * «План дня» — личная функция владельца приложения, не для всех пользователей.
 * Список id задаётся в DAILY_PLAN_USER_IDS (через запятую); по умолчанию — только владелец.
 */
const DEFAULT_OWNERS = ["Oku3jXJiTlMJmVMh9Oqal4hj1Kq8FoKb"];

export function dailyPlanUserIds() {
  const env = process.env.DAILY_PLAN_USER_IDS;
  return env ? env.split(",").map((s) => s.trim()).filter(Boolean) : DEFAULT_OWNERS;
}

export function canUseDailyPlan(userId: string | null | undefined) {
  if (!userId) return false;
  return dailyPlanUserIds().includes(userId);
}

/** Во сколько вечером напомнить о невыполненном плане (местное время). */
export const EVENING_TIME = "22:00";

/**
 * Планы на сегодня, где задачи не все сделаны, уже наступил вечер (22:00–23:59 по поясу владельца)
 * и вечернего push ещё не было.
 */
export async function plansUnfinishedEvening() {
  const ids = dailyPlanUserIds();
  if (ids.length === 0) return [];
  const profs = await db.select({ userId: profiles.userId, tz: profiles.timezone }).from(profiles).where(inArray(profiles.userId, ids));
  const out: (typeof dailyPlans.$inferSelect & { doneCount: number; total: number })[] = [];
  for (const pr of profs) {
    const now = localNow(pr.tz ?? "Europe/Prague");
    if (now.hm < EVENING_TIME) continue;
    const plan = await getDailyPlan(pr.userId, now.date);
    if (!plan || plan.eveningNotifiedAt) continue;
    const { done, total } = planProgress(plan);
    if (total > 0 && done < total) out.push({ ...plan, doneCount: done, total });
  }
  return out;
}

/** Пояса пользователей «Плана дня» — для расписания планировщика. */
export async function dailyPlanZones() {
  const ids = dailyPlanUserIds();
  if (ids.length === 0) return [];
  const profs = await db.select({ tz: profiles.timezone }).from(profiles).where(inArray(profiles.userId, ids));
  return [...new Set(profs.map((p) => p.tz ?? "Europe/Prague"))];
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

/**
 * Планы, о которых пора отправить push: generated_at уже наступил (план, записанный ночью,
 * ставит generated_at на утро) и не старше 12 часов, push ещё не было.
 */
export async function plansToNotify() {
  const now = new Date();
  const since = new Date(now.getTime() - 12 * 3600 * 1000);
  return db
    .select()
    .from(dailyPlans)
    .where(and(isNull(dailyPlans.notifiedAt), gt(dailyPlans.generatedAt, since), lte(dailyPlans.generatedAt, now)));
}

/** День засчитан, если сделано не меньше половины задач. */
function dayOk(p: { tasks: { id: string }[]; done: Record<string, boolean> }) {
  const { done, total } = planProgress(p);
  return total > 0 && done * 2 >= total;
}

const shiftDay = (iso: string, n: number) => {
  const d = new Date(`${iso}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
};

/**
 * Статистика плана дня: серия засчитанных дней подряд (сегодня ещё не окончен — не рвёт серию),
 * выполнение и средняя энергия за 7 и 30 дней, проценты по дням для графика.
 */
export function planStats(
  plans: { date: string; tasks: { id: string }[]; done: Record<string, boolean>; feedback?: { energy?: number | null } | null }[],
  today: string,
) {
  const by = new Map(plans.map((p) => [p.date, p]));
  let streak = 0;
  let d = by.get(today) && dayOk(by.get(today)!) ? today : shiftDay(today, -1);
  while (by.get(d) && dayOk(by.get(d)!)) {
    streak++;
    d = shiftDay(d, -1);
  }
  const period = (days: number) => {
    let done = 0;
    let total = 0;
    const energies: number[] = [];
    for (let i = 0; i < days; i++) {
      const p = by.get(shiftDay(today, -i));
      if (!p) continue;
      const pr = planProgress(p);
      done += pr.done;
      total += pr.total;
      if (p.feedback?.energy) energies.push(p.feedback.energy);
    }
    return {
      done,
      total,
      pct: total ? Math.round((done / total) * 100) : null,
      energy: energies.length ? Math.round((energies.reduce((a, e) => a + e, 0) / energies.length) * 10) / 10 : null,
    };
  };
  const days = Array.from({ length: 30 }, (_, i) => {
    const date = shiftDay(today, i - 29);
    const p = by.get(date);
    const pr = p ? planProgress(p) : null;
    return { date, pct: pr && pr.total ? pr.done / pr.total : null };
  });
  return { streak, week: period(7), month: period(30), days };
}
