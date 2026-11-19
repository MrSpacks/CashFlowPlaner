import { and, eq, gte, inArray, max } from "drizzle-orm";
import { db } from "@/db";
import { tripDeals, tripSettings } from "@/db/schema";
import { investUserIds } from "@/lib/invest";
import { buildUserForecast, getRates } from "@/lib/finance";
import { todayISO } from "@/lib/forecast";

/**
 * «Дешёвые выходные»: билеты туда-обратно из Праги на ближайшие выходные.
 * Источники неофициальные (те же JSON, что использует сайт перевозчика), поэтому каждый
 * источник обновляется отдельно: если один сломался, остаются прежние данные остальных.
 */

/** Кому доступно. Пока как «Инвестиции» (владелец); можно расширить через TRIPS_USER_IDS. */
export function canUseTrips(userId: string | null | undefined) {
  if (!userId) return false;
  const env = process.env.TRIPS_USER_IDS;
  const ids = env ? env.split(",").map((s) => s.trim()).filter(Boolean) : investUserIds();
  return ids.includes(userId);
}

export type TripMode = "plane" | "train";
export const TRIP_MODES: TripMode[] = ["plane", "train"];
export const WEEKENDS_AHEAD = 4;

export type TripDeal = typeof tripDeals.$inferSelect;
type NewDeal = typeof tripDeals.$inferInsert;

// ---------- даты ----------
const addDays = (iso: string, n: number) => {
  const d = new Date(`${iso}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
};
const weekday = (iso: string) => new Date(`${iso}T12:00:00Z`).getUTCDay(); // 0 = вс, 5 = пт

/** Пятницы ближайших выходных. Если сегодня уже суббота/воскресенье — начинаем со следующих. */
export function upcomingWeekends(today = todayISO(), count = WEEKENDS_AHEAD) {
  const toFri = (5 - weekday(today) + 7) % 7;
  const first = addDays(today, toFri);
  return Array.from({ length: count }, (_, i) => addDays(first, i * 7));
}
export const weekendDays = (fri: string) => ({ fri, sat: addDays(fri, 1), sun: addDays(fri, 2), mon: addDays(fri, 3) });

const hm = (s: string | null | undefined) => (s ? s.slice(0, 16) : null);

async function getJson(url: string, headers: Record<string, string> = {}) {
  const res = await fetch(url, {
    headers: { accept: "application/json", "user-agent": "Mozilla/5.0 (CashFlowPlaner)", ...headers },
    cache: "no-store",
    signal: AbortSignal.timeout(15000),
  });
  if (!res.ok) throw new Error(`${res.status} ${url}`);
  return res.json();
}

/** Ограниченный параллелизм, чтобы не заваливать сайты запросами. */
async function pool<T, R>(items: T[], limit: number, fn: (x: T) => Promise<R>) {
  const out: R[] = [];
  let i = 0;
  await Promise.all(
    Array.from({ length: Math.min(limit, items.length) }, async () => {
      while (i < items.length) {
        const x = items[i++];
        out.push(await fn(x));
      }
    }),
  );
  return out;
}

// ---------- окна вылета ----------
/**
 * Окна (слоты) по местному времени вылета. Туда — из Праги, обратно — из города назначения.
 * day — сдвиг от пятницы выходных.
 */
export const OUT_SLOTS = {
  fri_eve: { day: 0, from: 16, to: 24 },
  sat_morn: { day: 1, from: 0, to: 12 },
  sat_day: { day: 1, from: 12, to: 18 },
} as const;
export const BACK_SLOTS = {
  sat_eve: { day: 1, from: 16, to: 24 },
  sun_day: { day: 2, from: 10, to: 17 },
  sun_eve: { day: 2, from: 17, to: 24 },
  mon_morn: { day: 3, from: 5, to: 12 },
  mon_day: { day: 3, from: 12, to: 24 },
} as const;
export type OutSlot = keyof typeof OUT_SLOTS;
export type BackSlot = keyof typeof BACK_SLOTS;
export const OUT_SLOT_KEYS = Object.keys(OUT_SLOTS) as OutSlot[];
export const BACK_SLOT_KEYS = Object.keys(BACK_SLOTS) as BackSlot[];
export const DEFAULT_OUT: OutSlot[] = ["fri_eve", "sat_morn"];
export const DEFAULT_BACK: BackSlot[] = ["sun_day", "sun_eve"];

type Slot = { day: number; from: number; to: number };
const inSlot = (dt: string, fri: string, s: Slot) => {
  const h = Number(dt.slice(11, 13));
  return dt.slice(0, 10) === addDays(fri, s.day) && h >= s.from && h < s.to;
};
const hhmm = (h: number) => (h >= 24 ? "23:59" : `${String(h).padStart(2, "0")}:00`);

/** Пары «туда × обратно», где обратно не раньше, чем туда. */
const SLOT_PAIRS = OUT_SLOT_KEYS.flatMap((o) =>
  BACK_SLOT_KEYS.filter((b) => BACK_SLOTS[b].day > OUT_SLOTS[o].day || BACK_SLOTS[b].from >= OUT_SLOTS[o].to - 2).map((b) => [o, b] as const),
);

// ---------- дневные часы в городе ----------
export const DAY_FROM = 8;
export const DAY_TO = 22;
const toMs = (dt: string) => Date.parse(`${dt.slice(0, 16)}:00Z`); // местное время города как «UTC» — разница корректна

/** Сколько часов между прилётом и вылетом обратно приходится на 8:00–22:00 (время города назначения). */
export function daytimeHours(arrive: string | null, leave: string) {
  if (!arrive) return 0;
  const a = toMs(arrive);
  const b = toMs(leave);
  if (!(b > a)) return 0;
  let sum = 0;
  for (let day = Date.parse(`${arrive.slice(0, 10)}T00:00:00Z`); day < b; day += 86400000) {
    const s = Math.max(a, day + DAY_FROM * 3600000);
    const e = Math.min(b, day + DAY_TO * 3600000);
    if (e > s) sum += e - s;
  }
  return Math.round(sum / 3600000);
}
/** Ночей в городе (сколько раз встретили 3:00 между прилётом и вылетом). */
export function nightsIn(arrive: string | null, leave: string) {
  if (!arrive) return 0;
  let n = 0;
  for (let day = Date.parse(`${arrive.slice(0, 10)}T00:00:00Z`); day < toMs(leave); day += 86400000) {
    const t = day + 3 * 3600000;
    if (t > toMs(arrive) && t < toMs(leave)) n++;
  }
  return n;
}

// ---------- Ryanair ----------
type RyanairLeg = {
  departureAirport: { iataCode: string; city?: { name?: string; countryCode?: string }; name: string };
  arrivalAirport: { iataCode: string; city?: { name?: string; countryCode?: string }; name: string };
  departureDate: string;
  arrivalDate: string;
  flightNumber?: string;
};
type RyanairFare = { outbound: RyanairLeg; inbound: RyanairLeg; summary: { price: { value: number; currencyCode: string } } };

function ryanairUrl(dest: string, out: string, back: string) {
  const q = new URLSearchParams({
    adults: "1", teens: "0", children: "0", infants: "0",
    dateOut: out, dateIn: back, isConnectedFlight: "false", isReturn: "true", discount: "0",
    originIata: "PRG", destinationIata: dest,
  });
  return `https://www.ryanair.com/cz/cs/trip/flights/select?${q}`;
}

/**
 * Ryanair отдаёт самый дешёвый вариант на направление в заданном окне, поэтому спрашиваем
 * отдельно каждую пару окон (туда × обратно). Время дополнительно проверяем сами.
 */
async function fetchRyanair(weekends: string[]): Promise<NewDeal[]> {
  const jobs = weekends.flatMap((fri) => SLOT_PAIRS.map(([o, b]) => ({ fri, o, b })));
  const res = await pool(jobs, 4, async ({ fri, o, b }) => {
    const so = OUT_SLOTS[o];
    const sb = BACK_SLOTS[b];
    const q = new URLSearchParams({
      departureAirportIataCode: "PRG",
      outboundDepartureDateFrom: addDays(fri, so.day),
      outboundDepartureDateTo: addDays(fri, so.day),
      outboundDepartureTimeFrom: hhmm(so.from),
      outboundDepartureTimeTo: hhmm(so.to),
      inboundDepartureDateFrom: addDays(fri, sb.day),
      inboundDepartureDateTo: addDays(fri, sb.day),
      inboundDepartureTimeFrom: hhmm(sb.from),
      inboundDepartureTimeTo: hhmm(sb.to),
      currency: "CZK",
      market: "cs-cz",
      adultPaxCount: "1",
    });
    try {
      const j = (await getJson(`https://services-api.ryanair.com/farfnd/v4/roundTripFares?${q}`)) as { fares?: RyanairFare[] };
      return (j.fares ?? [])
        .filter((f) => inSlot(f.outbound.departureDate, fri, so) && inSlot(f.inbound.departureDate, fri, sb))
        .map((f): NewDeal => {
          const dest = f.outbound.arrivalAirport;
          return {
            weekend: fri,
            mode: "plane",
            source: "ryanair",
            outSlot: o,
            backSlot: b,
            destCode: dest.iataCode,
            destName: dest.city?.name || dest.name,
            countryCode: dest.city?.countryCode?.toUpperCase() ?? null,
            outDep: hm(f.outbound.departureDate)!,
            outArr: hm(f.outbound.arrivalDate),
            inDep: hm(f.inbound.departureDate)!,
            inArr: hm(f.inbound.arrivalDate),
            outNo: f.outbound.flightNumber ?? null,
            inNo: f.inbound.flightNumber ?? null,
            price: f.summary.price.value.toFixed(2),
            currency: f.summary.price.currencyCode || "CZK",
            url: ryanairUrl(dest.iataCode, f.outbound.departureDate.slice(0, 10), f.inbound.departureDate.slice(0, 10)),
          };
        });
    } catch {
      return null;
    }
  });
  if (res.every((r) => r === null)) throw new Error("ryanair: no data");
  return res.flatMap((r) => r ?? []);
}

// ---------- RegioJet (поезда и автобусы) ----------
const RJ_PRAGUE = 10202003;
/** Города RegioJet (id из /restapi/consts/locations), куда реально съездить на выходные. */
export const RJ_CITIES: { id: number; name: string; cc: string }[] = [
  { id: 10202052, name: "Vienna", cc: "AT" },
  { id: 10202001, name: "Bratislava", cc: "SK" },
  { id: 10202091, name: "Budapest", cc: "HU" },
  { id: 10202072, name: "Berlin", cc: "DE" },
  { id: 10202071, name: "Dresden", cc: "DE" },
  { id: 10202006, name: "Munich", cc: "DE" },
  { id: 888040003, name: "Salzburg", cc: "AT" },
  { id: 10202080, name: "Venice", cc: "IT" },
  { id: 10202033, name: "Košice", cc: "SK" },
  { id: 2737640000, name: "Warsaw", cc: "PL" },
];

type RjRoute = {
  departureTime: string;
  arrivalTime: string;
  priceFrom: number | null;
  bookable: boolean;
  freeSeatsCount: number | null;
};

/** Все продаваемые рейсы именно в этот день (API отдаёт и следующие дни — отсекаем). */
async function rjDay(from: number, to: number, day: string): Promise<RjRoute[]> {
  const q = new URLSearchParams({
    tariffs: "REGULAR",
    fromLocationType: "CITY",
    fromLocationId: String(from),
    toLocationType: "CITY",
    toLocationId: String(to),
    departureDate: day,
  });
  const j = (await getJson(`https://brn-ybus-pubapi.sa.cz/restapi/routes/search/simple?${q}`, {
    "X-Currency": "CZK",
    "X-Lang": "en",
  })) as { routes?: RjRoute[] };
  return (j.routes ?? []).filter((r) => r.departureTime.slice(0, 10) === day && r.bookable && (r.freeSeatsCount ?? 1) > 0 && r.priceFrom != null);
}

const cheapestIn = (routes: RjRoute[], fri: string, s: Slot) =>
  routes.filter((r) => inSlot(r.departureTime, fri, s)).sort((a, b) => a.priceFrom! - b.priceFrom!)[0] ?? null;

function regiojetUrl(to: number, out: string, back: string) {
  const q = new URLSearchParams({
    departureDate: out,
    returnDepartureDate: back,
    fromLocationId: String(RJ_PRAGUE),
    toLocationId: String(to),
    fromLocationType: "CITY",
    toLocationType: "CITY",
    tariffs: "REGULAR",
  });
  return `https://regiojet.cz/?${q}`;
}

async function fetchRegiojet(weekends: string[]): Promise<NewDeal[]> {
  const jobs = weekends.flatMap((fri) => RJ_CITIES.map((c) => ({ fri, c })));
  const res = await pool(jobs, 6, async ({ fri, c }) => {
    const d = weekendDays(fri);
    try {
      // Туда — пт и сб, обратно — сб, вс, пн. Потом раскладываем по окнам.
      const [oFri, oSat, bSat, bSun, bMon] = await Promise.all([
        rjDay(RJ_PRAGUE, c.id, d.fri),
        rjDay(RJ_PRAGUE, c.id, d.sat),
        rjDay(c.id, RJ_PRAGUE, d.sat),
        rjDay(c.id, RJ_PRAGUE, d.sun),
        rjDay(c.id, RJ_PRAGUE, d.mon),
      ]);
      const outs = [...oFri, ...oSat];
      const backs = [...bSat, ...bSun, ...bMon];
      const deals: NewDeal[] = [];
      for (const [o, b] of SLOT_PAIRS) {
        const out = cheapestIn(outs, fri, OUT_SLOTS[o]);
        const back = cheapestIn(backs, fri, BACK_SLOTS[b]);
        if (!out || !back || back.departureTime <= out.arrivalTime) continue;
        deals.push({
          weekend: fri,
          mode: "train",
          source: "regiojet",
          outSlot: o,
          backSlot: b,
          destCode: String(c.id),
          destName: c.name,
          countryCode: c.cc,
          outDep: hm(out.departureTime)!,
          outArr: hm(out.arrivalTime),
          inDep: hm(back.departureTime)!,
          inArr: hm(back.arrivalTime),
          outNo: null,
          inNo: null,
          price: (out.priceFrom! + back.priceFrom!).toFixed(2),
          currency: "CZK",
          url: regiojetUrl(c.id, out.departureTime.slice(0, 10), back.departureTime.slice(0, 10)),
        });
      }
      return deals;
    } catch {
      return null;
    }
  });
  if (res.every((r) => r === null)) throw new Error("regiojet: no data");
  return res.flatMap((r) => r ?? []);
}

/** Обновить кэш. Каждый источник заменяется целиком только при успешной загрузке. */
export async function refreshTripDeals() {
  const weekends = upcomingWeekends();
  const report: Record<string, number | string> = {};
  await Promise.all(
    (
      [
        ["ryanair", fetchRyanair],
        ["regiojet", fetchRegiojet],
      ] as const
    ).map(async ([source, fn]) => {
      try {
        const deals = await fn(weekends);
        await db.transaction(async (tx) => {
          await tx.delete(tripDeals).where(eq(tripDeals.source, source));
          for (let i = 0; i < deals.length; i += 500) await tx.insert(tripDeals).values(deals.slice(i, i + 500));
        });
        report[source] = deals.length;
      } catch (e) {
        report[source] = `error: ${(e as Error).message.slice(0, 120)}`;
      }
    }),
  );
  return report;
}

/** Когда кэш обновлялся последний раз. */
export async function lastTripRefresh() {
  const [r] = await db.select({ t: max(tripDeals.fetchedAt) }).from(tripDeals);
  return r?.t ?? null;
}

// ---------- настройки и выборка ----------
export type TripSort = "price" | "value";
export type TripPrefs = {
  maxPrice: number;
  modes: TripMode[];
  outSlots: OutSlot[];
  backSlots: BackSlot[];
  minHours: number;
  sort: TripSort;
  notify: boolean;
  notified: string[];
};

const parseList = <T extends string>(v: string | null | undefined, all: readonly T[], def: T[]) => {
  const xs = (v ?? "").split(",").filter((x): x is T => all.includes(x as T));
  return xs.length ? xs : def;
};

export async function getTripPrefs(userId: string): Promise<TripPrefs> {
  const [s] = await db.select().from(tripSettings).where(eq(tripSettings.userId, userId)).limit(1);
  return {
    maxPrice: Number(s?.maxPrice ?? 2000),
    modes: parseList(s?.modes, TRIP_MODES, TRIP_MODES),
    outSlots: parseList(s?.outSlots, OUT_SLOT_KEYS, DEFAULT_OUT),
    backSlots: parseList(s?.backSlots, BACK_SLOT_KEYS, DEFAULT_BACK),
    minHours: s?.minHours ?? 20,
    sort: s?.sort === "price" ? "price" : "value",
    notify: s?.notify ?? true,
    notified: s?.notified ?? [],
  };
}

export const dealKey = (d: Pick<TripDeal, "source" | "destCode" | "outDep" | "inDep">) => `${d.source}:${d.destCode}:${d.outDep}:${d.inDep}`;

export type TripOption = TripDeal & { hours: number; nights: number; perHour: number };

/**
 * Варианты под настройки пользователя: только его окна вылета, не меньше minHours дневных часов
 * в городе и не дороже maxPrice. На каждое направление и выходные — один лучший вариант.
 */
export async function listTripOptions(prefs: TripPrefs, opts: { weekend?: string; modes?: TripMode[] } = {}): Promise<TripOption[]> {
  const where = [gte(tripDeals.outDep, todayISO()), inArray(tripDeals.mode, opts.modes ?? prefs.modes)];
  if (opts.weekend) where.push(eq(tripDeals.weekend, opts.weekend));
  where.push(inArray(tripDeals.outSlot, prefs.outSlots), inArray(tripDeals.backSlot, prefs.backSlots));
  const rows = await db.select().from(tripDeals).where(and(...where));

  const best = new Map<string, TripOption>();
  for (const r of rows) {
    const price = Number(r.price);
    if (price > prefs.maxPrice) continue;
    const hours = daytimeHours(r.outArr, r.inDep);
    if (hours < prefs.minHours) continue;
    const opt: TripOption = { ...r, hours, nights: nightsIn(r.outArr, r.inDep), perHour: price / Math.max(hours, 1) };
    const k = `${r.weekend}:${r.source}:${r.destCode}`;
    const cur = best.get(k);
    const better = !cur || (prefs.sort === "price" ? price < Number(cur.price) || (price === Number(cur.price) && hours > cur.hours) : opt.perHour < cur.perHour);
    if (better) best.set(k, opt);
  }
  return [...best.values()].sort((a, b) => (prefs.sort === "price" ? Number(a.price) - Number(b.price) : a.perHour - b.perHour));
}

export type Budget = "ok" | "tight" | "negative";

/**
 * Хватит ли денег, если купить билет: самый низкий остаток прогноза с месяца поездки
 * и дальше минус цена. null — прогноз не настроен.
 */
export async function budgetChecker(userId: string) {
  const f = await buildUserForecast(userId);
  if (f.isEmpty || !f.months.length) return null;
  const rates = f.base === "CZK" ? {} : await getRates(f.base);
  return (deal: Pick<TripDeal, "outDep" | "price" | "currency">): { state: Budget; month: string } => {
    const month = deal.outDep.slice(0, 7);
    const from = f.months.filter((m) => m.month >= month);
    const price = deal.currency === f.base || !rates[deal.currency] ? Number(deal.price) : Number(deal.price) / rates[deal.currency];
    const low = Math.min(...(from.length ? from : f.months.slice(-1)).map((m) => m.closing)) - price;
    return { state: low < 0 ? "negative" : low < f.cushion ? "tight" : "ok", month };
  };
}
