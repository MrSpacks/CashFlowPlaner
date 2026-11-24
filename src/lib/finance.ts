import { and, desc, eq, gte, inArray } from "drizzle-orm";
import { db } from "@/db";
import { balanceSnapshots, budgets, fixedExpenses, incomes, incomeSources, oneTimeIncomes, profiles, spendings } from "@/db/schema";
import { budgetOutflow } from "./categories";
import { getItemsWithPayments, listUserEvents, occurrence } from "./events";
import { getSplitData, sharesOf } from "./split";
import { addMonths, dateInMonth, todayISO, type ForecastMonth } from "./forecast";

/** Курсы относительно базовой валюты (1 base = rate × quote). Раз в сутки, данные ЕЦБ. */
export async function getRates(base: string): Promise<Record<string, number>> {
  try {
    const res = await fetch(`https://api.frankfurter.dev/v1/latest?base=${base}`, { next: { revalidate: 86400 } });
    if (!res.ok) return {};
    const data = (await res.json()) as { rates?: Record<string, number> };
    return data.rates ?? {};
  } catch {
    return {};
  }
}

export async function getProfile(userId: string) {
  const [p] = await db.select().from(profiles).where(eq(profiles.userId, userId)).limit(1);
  if (p) return p;
  await db.insert(profiles).values({ userId }).onConflictDoNothing();
  const [created] = await db.select().from(profiles).where(eq(profiles.userId, userId)).limit(1);
  return created;
}

export async function getLatestBalance(userId: string) {
  const [snap] = await db
    .select()
    .from(balanceSnapshots)
    .where(eq(balanceSnapshots.ownerId, userId))
    .orderBy(desc(balanceSnapshots.asOfDate), desc(balanceSnapshots.createdAt))
    .limit(1);
  return snap ?? null;
}

export async function getIncomeData(userId: string) {
  const sources = await db
    .select()
    .from(incomeSources)
    .where(and(eq(incomeSources.ownerId, userId), eq(incomeSources.active, true)))
    .orderBy(incomeSources.createdAt);
  const rows = sources.length
    ? await db.select().from(incomes).where(inArray(incomes.sourceId, sources.map((s) => s.id)))
    : [];
  return { sources, rows };
}

export async function getOneTimeIncomes(userId: string) {
  return db.select().from(oneTimeIncomes).where(eq(oneTimeIncomes.ownerId, userId)).orderBy(oneTimeIncomes.date);
}

/** Входит ли разовый доход в прогноз (а не «уже в балансе»). */
export function oneTimeCounts(
  o: { date: string; createdAt: Date },
  snap: { asOfDate: string; createdAt: Date } | null | undefined,
) {
  if (!snap) return true;
  return o.date > snap.asOfDate || o.createdAt > snap.createdAt;
}

export async function getFixedExpenses(userId: string) {
  return db.select().from(fixedExpenses).where(eq(fixedExpenses.ownerId, userId)).orderBy(fixedExpenses.createdAt);
}

const num = (v: string | null | undefined) => (v == null ? null : Number(v));

export async function getBudgets(userId: string) {
  return db.select().from(budgets).where(eq(budgets.ownerId, userId));
}

/** Траты с даты from (включительно). */
export async function getSpendingsFrom(userId: string, from: string) {
  return db
    .select({
      id: spendings.id,
      date: spendings.date,
      amount: spendings.amount,
      currency: spendings.currency,
      category: spendings.category,
      note: spendings.note,
      receiptType: spendings.receiptType,
      createdAt: spendings.createdAt,
    })
    .from(spendings)
    .where(and(eq(spendings.ownerId, userId), gte(spendings.date, from)))
    .orderBy(desc(spendings.date), desc(spendings.createdAt));
}

/**
 * Прогноз по месяцам.
 * Точка отсчёта — последний «стартовый баланс». Учитываются только доходы и расходы
 * с датой ПОСЛЕ даты баланса (то, что было раньше, уже отражено в балансе).
 */
export async function buildUserForecast(userId: string, monthsAhead = 12) {
  const profile = await getProfile(userId);
  const base = profile.baseCurrency ?? "CZK";
  const cushion = Number(profile.cushionAmount ?? 0);
  const monthStart = `${todayISO(profile.timezone ?? "Europe/Prague").slice(0, 7)}-01`;
  const [snap, { sources, rows }, fixed, allEvents, oneTime, budgetRows, spent] = await Promise.all([
    getLatestBalance(userId),
    getIncomeData(userId),
    getFixedExpenses(userId),
    listUserEvents(userId),
    getOneTimeIncomes(userId),
    getBudgets(userId),
    getSpendingsFrom(userId, monthStart),
  ]);
  const evs = allEvents.filter((e) => e.status !== "cancelled" && e.status !== "idea");
  const { items, pays } = await getItemsWithPayments(evs.map((e) => e.id));
  const { parts, shares, setts } = await getSplitData(evs.map((e) => e.id));

  const needRates = [
    snap?.currency,
    ...sources.map((s) => s.currency),
    ...fixed.map((f) => f.currency),
    ...oneTime.map((o) => o.currency),
    ...budgetRows.map((b) => b.currency),
    ...spent.map((x) => x.currency),
    ...items.map((i) => i.currency),
    ...pays.map((p) => p.currency),
    ...setts.map((x) => x.currency),
  ].some((c) => c && c !== base);
  const rates = needRates ? await getRates(base) : {};
  const toBase = (amount: number, cur: string) => (cur === base || !rates[cur] ? amount : amount / rates[cur]);

  const today = todayISO(profile.timezone ?? "Europe/Prague");
  const startMonth = today.slice(0, 7);
  const cutoff = snap?.asOfDate ?? `${addMonths(startMonth, -1)}-31`; // без баланса считаем весь текущий месяц
  const horizonEnd = `${addMonths(startMonth, monthsAhead)}-01`;
  let opening = snap ? toBase(Number(snap.amount), snap.currency) : 0;

  // Движение денег по событиям.
  // Своё событие — вся сумма. Общее (несколько участников) — ТОЛЬКО МОЯ ДОЛЯ, кто бы ни платил:
  // кто кому должен, видно в самом событии, а из моих денег уходит лишь моя часть.
  type Flow = { date: string; amount: number; title: string; movable: boolean };
  const outflows: Flow[] = [];
  const inflows: Flow[] = [];
  const later = (d: string | null | undefined) => (!d || d < today ? today : d);

  for (const ev of evs) {
    const evParts = parts.filter((p) => p.eventId === ev.id);
    const me = evParts.find((p) => p.userId === userId);
    // События общего календаря, где я не участник, мои деньги не трогают.
    if (ev.createdBy !== userId && !me) continue;
    const shared = evParts.length > 1 && !!me;
    const movable = ev.priority === "movable";

    for (const it of items.filter((i) => i.eventId === ev.id)) {
      const title = `${ev.title} — ${it.title}`;
      const amount = Number(it.amount);
      const ratio = shared ? (sharesOf(it, evParts, shares).get(me!.id) ?? 0) / (amount || 1) : 1;
      if (ratio <= 0) continue;
      const when = it.dueDate ?? ev.startDate;

      const itPays = pays.filter((p) => p.expenseItemId === it.id);
      let paidSame = 0;
      for (const p of itPays) {
        if (p.currency === it.currency) paidSame += Number(p.amount);
        if (p.paidAt > cutoff) outflows.push({ date: p.paidAt, amount: toBase(Number(p.amount) * ratio, p.currency), title, movable: false });
      }
      const remaining = it.status === "paid" ? 0 : Math.max(amount - paidSame, 0);
      if (remaining > 0 && when) {
        // Неоплаченное ещё не ушло с баланса: просроченное — в текущий месяц.
        outflows.push({ date: later(when), amount: toBase(remaining * ratio, it.currency), title, movable });
      }
      if (ev.recurrence !== "none" && when) {
        // Следующие повторения (каждый месяц / каждый год).
        for (let k = 1; ; k++) {
          const d = occurrence(when, ev.recurrence, k);
          if (d >= horizonEnd) break;
          if (d >= today) outflows.push({ date: d, amount: toBase(amount * ratio, it.currency), title, movable });
        }
      }
    }
  }

  const result: ForecastMonth[] = [];
  for (let i = 0; i < monthsAhead; i++) {
    const month = addMonths(startMonth, i);
    let income = 0;
    let incomeMissing = false;

    for (const s of sources) {
      const row = rows.find((r) => r.sourceId === s.id && r.month.startsWith(month));
      const actual = num(row?.actualAmount);
      const value = actual ?? num(row?.expectedAmount) ?? (s.isFixed ? num(s.defaultAmount) : null);
      const date = actual != null && row?.receivedAt ? row.receivedAt : dateInMonth(month, s.payDay);
      if (value == null) {
        if (date > cutoff) incomeMissing = true;
        continue;
      }
      if (date > cutoff) income += toBase(value, s.currency);
    }

    // Разовые доходы. Считаются, если дата после баланса ИЛИ доход внесён после сохранения баланса
    // (значит, в баланс он не входил). Прошедшая дата — в текущий месяц.
    for (const o of oneTime) {
      if (!oneTimeCounts(o, snap)) continue;
      const d = o.date < today ? today : o.date;
      if (d.startsWith(month)) income += toBase(Number(o.amount), o.currency);
    }

    // Постоянные расходы без категории — как раньше, по дню месяца.
    // С категорией и лимиты бюджета — план категории на месяц: пока трачу меньше — считаем остаток плана,
    // превысил — считаем фактические траты (см. budgetOutflow).
    let fixedSum = 0;
    const plan = new Map<string, number>();
    for (const f of fixed) {
      if (f.activeFrom && f.activeFrom.slice(0, 7) > month) continue;
      if (f.activeTo && f.activeTo.slice(0, 7) < month) continue;
      if (f.category) plan.set(f.category, (plan.get(f.category) ?? 0) + toBase(Number(f.amount), f.currency));
      else if (dateInMonth(month, f.dayOfMonth) > cutoff) fixedSum += toBase(Number(f.amount), f.currency);
    }
    for (const b of budgetRows) plan.set(b.category, toBase(Number(b.monthlyLimit), b.currency));
    const monthSpent = spent.filter((x) => x.date.startsWith(month));
    const cats = new Set([...plan.keys(), ...monthSpent.map((x) => x.category)]);
    for (const c of cats) {
      const before = monthSpent.filter((x) => x.category === c && x.date <= cutoff).reduce((a, x) => a + toBase(Number(x.amount), x.currency), 0);
      const after = monthSpent.filter((x) => x.category === c && x.date > cutoff).reduce((a, x) => a + toBase(Number(x.amount), x.currency), 0);
      fixedSum += budgetOutflow(plan.get(c) ?? 0, before, after);
    }

    const monthOut = outflows.filter((o) => o.date.startsWith(month));
    const eventPayments = monthOut.reduce((a, o) => a + o.amount, 0);
    const refunds = inflows.filter((o) => o.date.startsWith(month)).reduce((a, o) => a + o.amount, 0);
    const closing = opening + income - fixedSum - eventPayments + refunds;
    const state = closing < 0 ? "negative" : closing < cushion ? "tight" : "ok";
    result.push({
      month,
      opening,
      income,
      incomeMissing,
      fixed: fixedSum,
      eventPayments,
      refunds,
      closing,
      state,
      movable: state === "ok" ? [] : monthOut.filter((o) => o.movable).map(({ title, amount }) => ({ title, amount })),
    });
    opening = closing;
  }

  return {
    base,
    cushion,
    snapshot: snap,
    months: result,
    isEmpty: !snap && sources.length === 0 && fixed.length === 0 && items.length === 0 && oneTime.length === 0,
  };
}
