import { and, asc, eq, gte, inArray } from "drizzle-orm";
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

async function fetchRyanair(weekends: string[]): Promise<NewDeal[]> {
  const deals: NewDeal[] = [];
  for (const fri of weekends) {
    const d = weekendDays(fri);
    const q = new URLSearchParams({
      departureAirportIataCode: "PRG",
      outboundDepartureDateFrom: d.fri,
      outboundDepartureDateTo: d.sat,
      inboundDepartureDateFrom: d.sun,
      inboundDepartureDateTo: d.mon,
      currency: "CZK",
      market: "cs-cz",
      adultPaxCount: "1",
      durationFrom: "1",
      durationTo: "4",
    });
    const j = (await getJson(`https://services-api.ryanair.com/farfnd/v4/roundTripFares?${q}`)) as { fares?: RyanairFare[] };
    for (const f of j.fares ?? []) {
      const dest = f.outbound.arrivalAirport;
      deals.push({
        weekend: fri,
        mode: "plane",
        source: "ryanair",
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
      });
    }
  }
  return deals;
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
  vehicleTypes?: string[];
};

/** Самый дешёвый рейс именно в этот день и в окно часов [fromH, toH). API отдаёт и следующие дни — отсекаем. */
async function rjCheapest(from: number, to: number, day: string, fromH = 0, toH = 24): Promise<RjRoute | null> {
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
  const ok = (j.routes ?? []).filter((r) => {
    const h = Number(r.departureTime.slice(11, 13));
    return r.departureTime.slice(0, 10) === day && h >= fromH && h < toH && r.bookable && (r.freeSeatsCount ?? 1) > 0 && r.priceFrom != null;
  });
  return ok.sort((a, b) => a.priceFrom! - b.priceFrom!)[0] ?? null;
}

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
      // Окно пт–пн: туда — пятница после 14:00 или суббота до 12:00,
      // обратно — воскресенье после 12:00 или понедельник после 5:00.
      const [fr, sa, su, mo] = await Promise.all([
        rjCheapest(RJ_PRAGUE, c.id, d.fri, 14),
        rjCheapest(RJ_PRAGUE, c.id, d.sat, 0, 12),
        rjCheapest(c.id, RJ_PRAGUE, d.sun, 12),
        rjCheapest(c.id, RJ_PRAGUE, d.mon, 5),
      ]);
      const cheaper = (a: RjRoute | null, b: RjRoute | null) => (!a ? b : !b ? a : a.priceFrom! <= b.priceFrom! ? a : b);
      const out = cheaper(fr, sa);
      const back = cheaper(su, mo);
      if (!out || !back) return null;
      const deal: NewDeal = {
        weekend: fri,
        mode: "train",
        source: "regiojet",
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
      };
      return deal;
    } catch {
      return null;
    }
  });
  const deals = res.filter((x): x is NewDeal => !!x);
  if (deals.length === 0) throw new Error("regiojet: no data");
  return deals;
}

/** Обновить кэш. Каждый источник заменяется целиком только при успешной загрузке. */
export async function refreshTripDeals() {
  const weekends = upcomingWeekends();
  const report: Record<string, number | string> = {};
  for (const [source, fn] of [
    ["ryanair", fetchRyanair],
    ["regiojet", fetchRegiojet],
  ] as const) {
    try {
      const deals = await fn(weekends);
      await db.transaction(async (tx) => {
        await tx.delete(tripDeals).where(eq(tripDeals.source, source));
        if (deals.length) await tx.insert(tripDeals).values(deals);
      });
      report[source] = deals.length;
    } catch (e) {
      report[source] = `error: ${(e as Error).message.slice(0, 120)}`;
    }
  }
  return report;
}

// ---------- настройки и выборка ----------
export type TripPrefs = { maxPrice: number; modes: TripMode[]; notify: boolean; notified: string[]; hiddenWeekend: string | null };

export async function getTripPrefs(userId: string): Promise<TripPrefs> {
  const [s] = await db.select().from(tripSettings).where(eq(tripSettings.userId, userId)).limit(1);
  const modes = (s?.modes ?? "plane,train").split(",").filter((m): m is TripMode => TRIP_MODES.includes(m as TripMode));
  return {
    maxPrice: Number(s?.maxPrice ?? 2000),
    modes: modes.length ? modes : TRIP_MODES,
    notify: s?.notify ?? true,
    notified: s?.notified ?? [],
    hiddenWeekend: s?.hiddenWeekend ?? null,
  };
}

export const dealKey = (d: Pick<TripDeal, "source" | "destCode" | "outDep" | "inDep">) => `${d.source}:${d.destCode}:${d.outDep}:${d.inDep}`;

/** Варианты на ближайшие выходные (от сегодняшнего дня), самые дешёвые первыми. */
export async function listTripDeals(opts: { modes?: TripMode[]; maxPrice?: number; weekend?: string } = {}) {
  const today = todayISO();
  const where = [gte(tripDeals.outDep, today)];
  if (opts.modes?.length) where.push(inArray(tripDeals.mode, opts.modes));
  if (opts.weekend) where.push(eq(tripDeals.weekend, opts.weekend));
  const rows = await db.select().from(tripDeals).where(and(...where)).orderBy(asc(tripDeals.price));
  return opts.maxPrice != null ? rows.filter((r) => Number(r.price) <= opts.maxPrice!) : rows;
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
