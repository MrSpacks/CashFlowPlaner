import { and, desc, eq, inArray } from "drizzle-orm";
import { db } from "@/db";
import { balanceSnapshots, fixedExpenses, incomes, incomeSources, profiles } from "@/db/schema";
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
  const [snap, { sources, rows }, fixed] = await Promise.all([
    getLatestBalance(userId),
    getIncomeData(userId),
    getFixedExpenses(userId),
  ]);

  const needRates = [
    snap?.currency,
    ...sources.map((s) => s.currency),
    ...fixed.map((f) => f.currency),
  ].some((c) => c && c !== base);
  const rates = needRates ? await getRates(base) : {};
  const toBase = (amount: number, cur: string) => (cur === base || !rates[cur] ? amount : amount / rates[cur]);

  const today = todayISO(profile.timezone ?? "Europe/Prague");
  const startMonth = today.slice(0, 7);
  const cutoff = snap?.asOfDate ?? `${addMonths(startMonth, -1)}-31`; // без баланса считаем весь текущий месяц
  let opening = snap ? toBase(Number(snap.amount), snap.currency) : 0;

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

    const closing = opening + income - fixedSum;
    result.push({
      month,
      opening,
      income,
      incomeMissing,
      fixed: fixedSum,
      eventPayments: 0,
      refunds: 0,
      closing,
      state: closing < 0 ? "negative" : closing < cushion ? "tight" : "ok",
      movable: [],
    });
    opening = closing;
  }

  return {
    base,
    snapshot: snap,
    months: result,
    isEmpty: !snap && sources.length === 0 && fixed.length === 0,
  };
}
