import { getItemsWithPayments, listUserEvents, nextOccurrence } from "./events";
import { getSplitData, payerOf } from "./split";

export interface Reminder {
  kind: "overdue" | "due" | "event";
  title: string;
  date: string;
  days: number; // через сколько дней (отрицательно — просрочено)
  amount?: number;
  currency?: string;
  eventId: string;
}

function addDays(iso: string, n: number) {
  const [y, m, d] = iso.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d + n));
  return dt.toISOString().slice(0, 10);
}

function diffDays(from: string, to: string) {
  return Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86400000);
}

/**
 * Что пора оплатить и какие события скоро.
 * Учитываются только события, где пользователь автор или участник,
 * и только траты, которые платит он (в общих — его плательщиком).
 */
export async function getReminders(userId: string, today: string, payDays = 7, eventDays = 7): Promise<Reminder[]> {
  const evs = (await listUserEvents(userId)).filter((e) => e.status !== "idea" && e.status !== "cancelled");
  const ids = evs.map((e) => e.id);
  const [{ items, pays }, { parts }] = await Promise.all([getItemsWithPayments(ids), getSplitData(ids)]);
  const payLimit = addDays(today, payDays);
  const evLimit = addDays(today, eventDays);
  const res: Reminder[] = [];

  for (const ev of evs) {
    const evParts = parts.filter((p) => p.eventId === ev.id);
    const me = evParts.find((p) => p.userId === userId);
    if (ev.createdBy !== userId && !me) continue;

    for (const it of items.filter((i) => i.eventId === ev.id && (i.status !== "paid" || ev.recurrence !== "none"))) {
      const payer = payerOf(it, ev, parts);
      if (evParts.length > 1 && payer !== me?.id) continue;
      const base = it.dueDate ?? ev.startDate;
      if (!base) continue;
      // Повторяющиеся (аренда каждый месяц): напоминаем о ближайшем повторении.
      const recurring = ev.recurrence !== "none" && base < today;
      const due = recurring ? nextOccurrence(base, ev.recurrence, today) : base;
      if (due > payLimit) continue;
      const paid = pays
        .filter((p) => p.expenseItemId === it.id && p.currency === it.currency)
        .reduce((a, p) => a + Number(p.amount), 0);
      const left = recurring ? Number(it.amount) : Math.max(Number(it.amount) - paid, 0);
      if (left <= 0) continue;
      res.push({
        kind: due < today ? "overdue" : "due",
        title: `${ev.title} — ${it.title}`,
        date: due,
        days: diffDays(today, due),
        amount: left,
        currency: it.currency,
        eventId: ev.id,
      });
    }

    const start = ev.startDate ? nextOccurrence(ev.startDate, ev.recurrence, today) : null;
    if (start && start >= today && start <= evLimit) {
      res.push({ kind: "event", title: ev.title, date: start, days: diffDays(today, start), eventId: ev.id });
    }
  }

  const order = { overdue: 0, due: 1, event: 2 };
  return res.sort((a, b) => order[a.kind] - order[b.kind] || a.date.localeCompare(b.date));
}
