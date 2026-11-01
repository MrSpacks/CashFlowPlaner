export type MonthKey = string; // "2026-11"
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

export const CURRENCIES = ["CZK", "EUR", "USD", "GBP", "PLN", "CHF", "HUF"] as const;

export function addMonths(key: MonthKey, n: number): MonthKey {
  const [y, m] = key.split("-").map(Number);
  const d = new Date(Date.UTC(y, m - 1 + n, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

/** Сегодняшняя дата "YYYY-MM-DD" в часовом поясе пользователя. */
export function todayISO(timeZone = "Europe/Prague") {
  return new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
}

export function daysInMonth(key: MonthKey) {
  const [y, m] = key.split("-").map(Number);
  return new Date(Date.UTC(y, m, 0)).getUTCDate();
}

/** Дата внутри месяца с ограничением по числу дней (31 → 30 в ноябре). */
export function dateInMonth(key: MonthKey, day: number | null | undefined) {
  const d = Math.min(Math.max(day ?? 1, 1), daysInMonth(key));
  return `${key}-${String(d).padStart(2, "0")}`;
}

export function formatMoney(amount: number, currency = "CZK", intlLocale = "ru-RU") {
  try {
    return new Intl.NumberFormat(intlLocale, { style: "currency", currency, maximumFractionDigits: 0 }).format(amount);
  } catch {
    return `${Math.round(amount)} ${currency}`;
  }
}

export function formatDate(iso: string, intlLocale = "ru-RU") {
  const [y, m, d] = iso.split("-").map(Number);
  return new Intl.DateTimeFormat(intlLocale, { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" }).format(
    new Date(Date.UTC(y, m - 1, d)),
  );
}

export function monthLabel(key: MonthKey, months: string[]) {
  const [y, m] = key.split("-").map(Number);
  return `${months[m - 1]} ${y}`;
}

/** "12 500,50" → 12500.5; пусто/мусор → null */
export function parseAmount(v: FormDataEntryValue | null): number | null {
  if (v == null) return null;
  const s = String(v).replace(/\s| /g, "").replace(",", ".");
  if (s === "") return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}
