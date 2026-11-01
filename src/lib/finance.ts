import { and, desc, eq, inArray } from "drizzle-orm";
import { db } from "@/db";
import { balanceSnapshots, fixedExpenses, incomes, incomeSources, profiles } from "@/db/schema";
import { getItemsWithPayments, listUserEvents, shiftYear } from "./events";
import { getSplitData, payerOf, sharesOf } from "./split";
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
  const [created] = await db.insert(profiles).values({ userId }).onConflictDoNothing().returning();
  return created ?? { userId, baseCurrency: "CZK", cushionAmount: "0", displayName: null, timezone: "Europe/Prague", createdAt: new Date() };
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

export async function getFixedExpenses(userId: string) {
  return db.select().from(fixedExpenses).where(eq(fixedExpenses.ownerId, userId)).orderBy(fixedExpenses.createdAt);
}

const num = (v: string | null | undefined) => (v == null ? null : Number(v));

/**
 * Прогноз по месяцам.
 * Точка отсчёта — последний «стартовый баланс». Учитываются только доходы и расходы
 * с датой ПОСЛЕ даты баланса (то, что было раньше, уже отражено в балансе).
 */
export async function buildUserForecast(userId: string, monthsAhead = 12) {
  const profile = await getProfile(userId);
  const base = profile.baseCurrency ?? "CZK";
  const cushion = Number(profile.cushionAmount ?? 0);
  const [snap, { sources, rows }, fixed, allEvents] = await Promise.all([
    getLatestBalance(userId),
    getIncomeData(userId),
    getFixedExpenses(userId),
    listUserEvents(userId),
  ]);
  const evs = allEvents.filter((e) => e.status !== "cancelled" && e.status !== "idea");
  const { items, pays } = await getItemsWithPayments(evs.map((e) => e.id));
  const { parts, shares, setts } = await getSplitData(evs.map((e) => e.id));

  const needRates = [
    snap?.currency,
    ...sources.map((s) => s.currency),
    ...fixed.map((f) => f.currency),
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
  // Своё: оплаты, которые делаю я (после даты баланса) + то, что мне ещё предстоит оплатить.
  // Общие события: моя доля в чужих оплатах — долг (отток), доли других в моих оплатах — возврат (приток).
  const evById = new Map(evs.map((e) => [e.id, e]));
  type Flow = { date: string; amount: number; title: string; movable: boolean };
  const outflows: Flow[] = [];
  const inflows: Flow[] = [];
  const later = (d: string | null | undefined) => (!d || d < today ? today : d);

  for (const ev of evs) {
    const evParts = parts.filter((p) => p.eventId === ev.id);
    const me = evParts.find((p) => p.userId === userId);
    const shared = evParts.length > 1 && !!me;
    const movable = ev.priority === "movable";
    const settleDate = later(ev.endDate ?? ev.startDate);
    let expectIn = 0; // в валюте base
    let expectOut = 0;

    for (const it of items.filter((i) => i.eventId === ev.id)) {
      const title = `${ev.title} — ${it.title}`;
      const payer = payerOf(it, ev, parts);
      const iPay = !shared || payer === me?.id;
      const when = it.dueDate ?? ev.startDate;

      if (shared) {
        const sh = sharesOf(it, evParts, shares);
        const mine = sh.get(me!.id) ?? 0;
        if (iPay) expectIn += toBase(Number(it.amount) - mine, it.currency);
        else expectOut += toBase(mine, it.currency);
      }
      if (!iPay) continue;

      const itPays = pays.filter((p) => p.expenseItemId === it.id);
      let paidSame = 0;
      for (const p of itPays) {
        if (p.currency === it.currency) paidSame += Number(p.amount);
        if (p.paidAt > cutoff) outflows.push({ date: p.paidAt, amount: toBase(Number(p.amount), p.currency), title, movable: false });
      }
      const remaining = it.status === "paid" ? 0 : Math.max(Number(it.amount) - paidSame, 0);
      if (remaining > 0 && when) {
        // Неоплаченное ещё не ушло с баланса: просроченное — в текущий месяц.
        outflows.push({ date: later(when), amount: toBase(remaining, it.currency), title, movable });
      }
      if (ev.recurrence === "yearly" && when && !shared) {
        for (let y = Number(when.slice(0, 4)) + 1; ; y++) {
          const d = shiftYear(when, y);
          if (d >= horizonEnd) break;
          if (d >= today) outflows.push({ date: d, amount: toBase(Number(it.amount), it.currency), title, movable });
        }
      }
    }

    if (shared) {
      // Уже сделанные возвраты уменьшают ожидаемые и (если после даты баланса) сами двигают деньги.
      for (const st of setts.filter((x) => x.eventId === ev.id)) {
        const v = toBase(Number(st.amount), st.currency);
        const date = st.settledAt ?? today;
        if (st.toParticipantId === me!.id) {
          expectIn -= v;
          if (date > cutoff) inflows.push({ date, amount: v, title: ev.title, movable: false });
        } else if (st.fromParticipantId === me!.id) {
          expectOut -= v;
          if (date > cutoff) outflows.push({ date, amount: v, title: ev.title, movable: false });
        }
      }
      // Взаимозачёт внутри события: двигается только разница.
      const net = expectIn - expectOut;
      if (net > 0.5) inflows.push({ date: settleDate, amount: net, title: ev.title, movable: false });
      else if (net < -0.5) outflows.push({ date: settleDate, amount: -net, title: ev.title, movable });
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

    let fixedSum = 0;
    for (const f of fixed) {
      if (f.activeFrom && f.activeFrom.slice(0, 7) > month) continue;
      if (f.activeTo && f.activeTo.slice(0, 7) < month) continue;
      if (dateInMonth(month, f.dayOfMonth) > cutoff) fixedSum += toBase(Number(f.amount), f.currency);
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
    snapshot: snap,
    months: result,
    isEmpty: !snap && sources.length === 0 && fixed.length === 0 && items.length === 0,
  };
}
