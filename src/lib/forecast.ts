/**
 * Расчёт прогноза баланса по месяцам.
 * Все суммы уже приведены к базовой валюте пользователя.
 *
 * остаток на конец = остаток с прошлого месяца
 *                  + доходы (факт, иначе ожидание)
 *                  − постоянные расходы
 *                  − мои оплаты по событиям
 *                  + ожидаемые возвраты от других
 */

export type MonthKey = string; // "2026-11"

export interface ForecastInput {
  startBalance: number;
  startMonth: MonthKey;
  months: number;
  cushion: number;
  incomes: { month: MonthKey; amount: number; actual: boolean }[];
  fixedMonthly: number;
  payments: { month: MonthKey; amount: number; title: string; movable: boolean }[];
  refunds: { month: MonthKey; amount: number }[];
}

export type MonthState = "ok" | "tight" | "negative";

export interface ForecastMonth {
  month: MonthKey;
  opening: number;
  income: number;
  incomeMissing: boolean;
  fixed: number;
  eventPayments: number;
  refunds: number;
  closing: number;
  state: MonthState;
  movable: { title: string; amount: number }[];
}

export function addMonths(key: MonthKey, n: number): MonthKey {
  const [y, m] = key.split("-").map(Number);
  const d = new Date(Date.UTC(y, m - 1 + n, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

export function monthKey(date: Date): MonthKey {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

const sum = (xs: number[]) => xs.reduce((a, b) => a + b, 0);

export function buildForecast(input: ForecastInput): ForecastMonth[] {
  const result: ForecastMonth[] = [];
  let opening = input.startBalance;

  for (let i = 0; i < input.months; i++) {
    const month = addMonths(input.startMonth, i);
    const inc = input.incomes.filter((x) => x.month === month);
    const pays = input.payments.filter((x) => x.month === month);
    const income = sum(inc.map((x) => x.amount));
    const eventPayments = sum(pays.map((x) => x.amount));
    const refunds = sum(input.refunds.filter((x) => x.month === month).map((x) => x.amount));
    const closing = opening + income - input.fixedMonthly - eventPayments + refunds;

    const state: MonthState = closing < 0 ? "negative" : closing < input.cushion ? "tight" : "ok";

    result.push({
      month,
      opening,
      income,
      incomeMissing: inc.length === 0,
      fixed: input.fixedMonthly,
      eventPayments,
      refunds,
      closing,
      state,
      movable: state === "ok" ? [] : pays.filter((p) => p.movable).map(({ title, amount }) => ({ title, amount })),
    });
    opening = closing;
  }
  return result;
}

export function formatMoney(amount: number, currency = "CZK") {
  return new Intl.NumberFormat("ru-RU", {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
  }).format(amount);
}

const MONTHS_RU = [
  "Январь", "Февраль", "Март", "Апрель", "Май", "Июнь",
  "Июль", "Август", "Сентябрь", "Октябрь", "Ноябрь", "Декабрь",
];

export function monthLabel(key: MonthKey) {
  const [y, m] = key.split("-").map(Number);
  return `${MONTHS_RU[m - 1]} ${y}`;
}
