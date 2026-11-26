import { inArray } from "drizzle-orm";
import { db } from "@/db";
import { dividendHistory } from "@/db/schema";
import { getRates } from "./finance";
import { latestSnapshot } from "./invest";

/** Тикер Trading 212 → тикер Yahoo Finance. AAPL_US_EQ → AAPL, VOW3d_EQ → VOW3.DE, MCp_EQ → MC.PA, VUAGl_EQ → VUAG.L. */
const EXCH: Record<string, string> = { l: ".L", d: ".DE", p: ".PA", a: ".AS", m: ".MI", e: ".MC", s: ".SW", b: ".BR", h: ".HE", o: ".OL", k: ".CO", w: ".WA", v: ".VI", i: ".IR", t: ".TO" };
export function t212ToYahoo(t: string) {
  if (t.endsWith("_US_EQ")) return t.slice(0, -6).replace(/\./g, "-");
  const m = /^(.+?)([a-z])_EQ$/.exec(t);
  if (m && EXCH[m[2]]) return m[1] + EXCH[m[2]];
  return t.replace(/_EQ$/, "");
}

type Payment = { date: string; amount: number };

async function fetchYahoo(symbol: string): Promise<{ currency: string | null; payments: Payment[] } | null> {
  try {
    const r = await fetch(
      `https://query2.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?range=3y&interval=1d&events=div`,
      { headers: { "User-Agent": "Mozilla/5.0 (CashFlowPlaner dividend calendar)" }, cache: "no-store" },
    );
    if (!r.ok) return null;
    const j = (await r.json()) as {
      chart?: { result?: { meta?: { currency?: string }; events?: { dividends?: Record<string, { amount: number; date: number }> } }[] };
    };
    const res = j.chart?.result?.[0];
    if (!res) return null;
    let cur = res.meta?.currency ?? null;
    let k = 1;
    if (cur === "GBp" || cur === "GBX") {
      cur = "GBP";
      k = 0.01;
    }
    const payments = Object.values(res.events?.dividends ?? {})
      .map((d) => ({ date: new Date(d.date * 1000).toISOString().slice(0, 10), amount: d.amount * k }))
      .sort((a, b) => a.date.localeCompare(b.date));
    return { currency: cur, payments };
  } catch {
    return null;
  }
}

/** История выплат по тикерам: из кэша, устаревшее (старше 7 дней) — заново из Yahoo. */
export async function dividendHistoryFor(symbols: string[]) {
  if (symbols.length === 0) return new Map<string, { currency: string | null; payments: Payment[]; ok: boolean }>();
  const cached = await db.select().from(dividendHistory).where(inArray(dividendHistory.symbol, symbols));
  const fresh = new Map(cached.filter((c) => Date.now() - c.fetchedAt.getTime() < 7 * 86400_000).map((c) => [c.symbol, c]));
  const stale = symbols.filter((s) => !fresh.has(s));
  const fetched = await Promise.all(stale.map(async (s) => [s, await fetchYahoo(s)] as const));
  for (const [s, f] of fetched) {
    const row = { symbol: s, currency: f?.currency?.slice(0, 3) ?? null, payments: f?.payments ?? [], ok: !!f, fetchedAt: new Date() };
    // Не затирать хорошие старые данные, если Yahoo сейчас не ответил.
    const old = cached.find((c) => c.symbol === s);
    if (!f && old?.ok) {
      fresh.set(s, old);
      continue;
    }
    await db.insert(dividendHistory).values(row).onConflictDoUpdate({ target: dividendHistory.symbol, set: row });
    fresh.set(s, row);
  }
  return new Map([...fresh].map(([s, c]) => [s, { currency: c.currency, payments: c.payments, ok: c.ok }]));
}

const addYears = (iso: string, n: number) => `${Number(iso.slice(0, 4)) + n}${iso.slice(4)}`;

/**
 * Прогноз выплат на 12 месяцев вперёд: каждая выплата за последний год повторяется через год
 * той же суммой на акцию (по ex-date). Чистая функция — проверяется тестами.
 */
export function projectDividends(payments: Payment[], today: string) {
  const yearAgo = addYears(today, -1);
  const lastYear = payments.filter((p) => p.date > yearAgo && p.date <= today);
  const future = payments.filter((p) => p.date > today); // уже объявленные
  const projected = lastYear
    .map((p) => ({ date: addYears(p.date, 1), amount: p.amount, announced: false }))
    .filter((p) => !future.some((f) => f.date.slice(0, 7) === p.date.slice(0, 7)));
  return [...future.map((f) => ({ ...f, announced: true })), ...projected]
    .filter((p) => p.date <= addYears(today, 1))
    .sort((a, b) => a.date.localeCompare(b.date));
}

export type DividendRow = {
  ticker: string;
  symbol: string;
  name: string;
  quantity: number;
  currency: string | null;
  perYearPerShare: number;
  perYearBase: number;
  frequency: number;
  yieldPct: number | null;
  ok: boolean;
};

/** Календарь дивидендов по текущему портфелю: выплаты по месяцам и сводка по бумагам (в валюте счёта). */
export async function dividendCalendar(userId: string, today: string) {
  const snap = await latestSnapshot(userId);
  if (!snap) return null;
  const base = snap.currency;
  const pos = snap.positions.filter((p) => p.quantity > 0);
  const symbols = pos.map((p) => t212ToYahoo(p.ticker));
  const [hist, rates] = await Promise.all([dividendHistoryFor(symbols), getRates(base)]);
  const toBase = (n: number, cur: string | null) => (!cur || cur === base || !rates[cur] ? n : n / rates[cur]);

  const events: { date: string; ticker: string; name: string; perShare: number; currency: string | null; total: number; totalBase: number; announced: boolean }[] = [];
  const rows: DividendRow[] = [];
  for (const p of pos) {
    const symbol = t212ToYahoo(p.ticker);
    const h = hist.get(symbol);
    const proj = h ? projectDividends(h.payments, today) : [];
    const perYearPerShare = proj.reduce((a, x) => a + x.amount, 0);
    for (const x of proj) {
      const total = x.amount * p.quantity;
      events.push({ date: x.date, ticker: p.ticker, name: p.name, perShare: x.amount, currency: h?.currency ?? null, total, totalBase: toBase(total, h?.currency ?? null), announced: x.announced });
    }
    const perYearBase = toBase(perYearPerShare * p.quantity, h?.currency ?? null);
    rows.push({
      ticker: p.ticker,
      symbol,
      name: p.name,
      quantity: p.quantity,
      currency: h?.currency ?? null,
      perYearPerShare,
      perYearBase,
      frequency: proj.length,
      yieldPct: p.value > 0 ? (perYearBase / p.value) * 100 : null,
      ok: h?.ok ?? false,
    });
  }
  events.sort((a, b) => a.date.localeCompare(b.date));
  const months = Array.from({ length: 12 }, (_, i) => {
    const d = new Date(`${today.slice(0, 7)}-15T12:00:00Z`);
    d.setUTCMonth(d.getUTCMonth() + i);
    const m = d.toISOString().slice(0, 7);
    return { month: m, total: events.filter((e) => e.date.startsWith(m)).reduce((a, e) => a + e.totalBase, 0) };
  });
  const yearTotal = events.reduce((a, e) => a + e.totalBase, 0);
  const portfolio = pos.reduce((a, p) => a + p.value, 0);
  rows.sort((a, b) => b.perYearBase - a.perYearBase);
  return { base, events, months, rows, yearTotal, yieldPct: portfolio > 0 ? (yearTotal / portfolio) * 100 : null, takenAt: snap.takenAt };
}
