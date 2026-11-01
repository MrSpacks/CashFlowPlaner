import { and, asc, eq, inArray, or } from "drizzle-orm";
import { db } from "@/db";
import { calendarMembers, calendars, events, expenseItems, payments } from "@/db/schema";

export type EventRow = typeof events.$inferSelect;
export type ItemRow = typeof expenseItems.$inferSelect;
export type PaymentRow = typeof payments.$inferSelect;

export const EVENT_TYPES = ["trip", "birthday", "health", "purchase", "other"] as const;
export const EVENT_STATUSES = ["idea", "planned", "confirmed", "done", "cancelled"] as const;
export const EVENT_PRIORITIES = ["must", "want", "movable"] as const;
export const TYPE_ICON: Record<(typeof EVENT_TYPES)[number], string> = {
  trip: "✈️",
  birthday: "🎂",
  health: "🩺",
  purchase: "🛍️",
  other: "📌",
};
export const TYPE_DOT: Record<(typeof EVENT_TYPES)[number], string> = {
  trip: "bg-sky-500",
  birthday: "bg-pink-500",
  health: "bg-rose-500",
  purchase: "bg-amber-500",
  other: "bg-slate-400",
};

/** Календари, к которым у пользователя есть доступ (свои + приглашения). */
export async function getUserCalendarIds(userId: string): Promise<string[]> {
  const owned = await db.select({ id: calendars.id }).from(calendars).where(eq(calendars.ownerId, userId));
  const member = await db
    .select({ id: calendarMembers.calendarId })
    .from(calendarMembers)
    .where(eq(calendarMembers.userId, userId));
  return [...new Set([...owned, ...member].map((r) => r.id))];
}

/** Личный календарь пользователя (создаётся при необходимости). */
export async function getDefaultCalendarId(userId: string, name = "Calendar"): Promise<string> {
  const [own] = await db
    .select({ id: calendars.id })
    .from(calendars)
    .where(eq(calendars.ownerId, userId))
    .orderBy(asc(calendars.createdAt))
    .limit(1);
  if (own) return own.id;
  const [created] = await db.insert(calendars).values({ ownerId: userId, name }).returning({ id: calendars.id });
  return created.id;
}

/** Событие, если у пользователя есть к нему доступ. Личные события видит только автор. */
export async function getEventForUser(eventId: string, userId: string): Promise<EventRow | null> {
  if (!/^[0-9a-f-]{36}$/i.test(eventId)) return null;
  const ids = await getUserCalendarIds(userId);
  if (ids.length === 0) return null;
  const [ev] = await db
    .select()
    .from(events)
    .where(and(eq(events.id, eventId), inArray(events.calendarId, ids)))
    .limit(1);
  if (!ev) return null;
  if (ev.visibility === "private" && ev.createdBy !== userId) return null;
  return ev;
}

export async function listUserEvents(userId: string): Promise<EventRow[]> {
  const ids = await getUserCalendarIds(userId);
  if (ids.length === 0) return [];
  const rows = await db
    .select()
    .from(events)
    .where(
      and(
        inArray(events.calendarId, ids),
        or(eq(events.visibility, "calendar"), eq(events.createdBy, userId)),
      ),
    )
    .orderBy(asc(events.startDate), asc(events.createdAt));
  return rows;
}

export async function getItemsWithPayments(eventIds: string[]) {
  if (eventIds.length === 0) return { items: [] as ItemRow[], pays: [] as PaymentRow[] };
  const items = await db
    .select()
    .from(expenseItems)
    .where(inArray(expenseItems.eventId, eventIds))
    .orderBy(asc(expenseItems.dueDate), asc(expenseItems.createdAt));
  const pays = items.length
    ? await db.select().from(payments).where(inArray(payments.expenseItemId, items.map((i) => i.id)))
    : [];
  return { items, pays };
}

/** Повторяющееся ежегодно событие: дата в нужном году. */
export function shiftYear(iso: string, year: number) {
  const md = iso.slice(5);
  if (md === "02-29") {
    const leap = (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
    return `${year}-${leap ? "02-29" : "02-28"}`;
  }
  return `${year}-${md}`;
}

/** События пользователя с суммами (в валюте события, грубо — без пересчёта чужих валют). */
export async function listEventsWithTotals(userId: string) {
  const evs = await listUserEvents(userId);
  const { items, pays } = await getItemsWithPayments(evs.map((e) => e.id));
  return evs.map((e) => {
    let total = 0;
    let unpaid = 0;
    for (const it of items.filter((i) => i.eventId === e.id && i.currency === e.currency)) {
      total += Number(it.amount);
      if (it.status !== "paid") {
        const p = pays.filter((x) => x.expenseItemId === it.id && x.currency === it.currency).reduce((a, x) => a + Number(x.amount), 0);
        unpaid += Math.max(Number(it.amount) - p, 0);
      }
    }
    return { ...e, total, unpaid };
  });
}
