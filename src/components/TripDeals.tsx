import Link from "next/link";
import { addTripIdea, refreshTripsNow, saveTripSettings } from "@/app/actions";
import { btnCls, btnGhostCls, cardCls, inputCls, labelCls } from "@/components/ui";
import type { Dict } from "@/i18n/dictionaries";
import { formatMoney } from "@/lib/forecast";
import {
  BACK_SLOT_KEYS,
  budgetChecker,
  DAY_FROM,
  DAY_TO,
  getTripPrefs,
  lastTripRefresh,
  listTripOptions,
  OUT_SLOT_KEYS,
  TRIP_MODES,
  upcomingWeekends,
  weekendDays,
  type Budget,
  type TripMode,
  type TripOption,
} from "@/lib/trips";

const BADGE: Record<Budget, string> = {
  ok: "bg-emerald-100 text-emerald-700",
  tight: "bg-amber-100 text-amber-700",
  negative: "bg-rose-100 text-rose-700",
};
const ICON: Record<TripMode, string> = { plane: "✈️", train: "🚆" };
const HOURS = [0, 8, 12, 16, 20, 24, 30, 36];

const time = (s: string | null) => (s ? s.slice(11, 16) : "");
const wd = (iso: string, intl: string) =>
  new Intl.DateTimeFormat(intl, { timeZone: "UTC", weekday: "short" }).format(new Date(`${iso.slice(0, 10)}T12:00:00Z`));
const short = (iso: string, intl: string) =>
  new Intl.DateTimeFormat(intl, { timeZone: "UTC", day: "numeric", month: "short" }).format(new Date(`${iso}T12:00:00Z`));

/** Полоса пт 00:00 – пн 24:00: светлые — дневные часы, синие — дорога, зелёная — время в городе. */
function Timeline({ d, intl }: { d: TripOption; intl: string }) {
  const base = Date.parse(`${d.weekend}T00:00:00Z`);
  const span = 4 * 86400000;
  const pos = (dt: string | null) => (dt ? Math.min(100, Math.max(0, ((Date.parse(`${dt}:00Z`) - base) / span) * 100)) : 0);
  const seg = (a: string | null, b: string | null, cls: string, key: string) => {
    const l = pos(a);
    const w = Math.max(pos(b) - l, 0.8);
    return <span key={key} className={`absolute inset-y-0 ${cls}`} style={{ left: `${l}%`, width: `${w}%` }} />;
  };
  const day = weekendDays(d.weekend);
  const isos = [day.fri, day.sat, day.sun, day.mon];
  return (
    <div className="mt-2" aria-hidden="true">
      <div className="relative h-3 overflow-hidden rounded bg-slate-200">
        {isos.map((_, i) => (
          <span
            key={i}
            className="absolute inset-y-0 bg-slate-50"
            style={{ left: `${((i * 24 + DAY_FROM) / 96) * 100}%`, width: `${((DAY_TO - DAY_FROM) / 96) * 100}%` }}
          />
        ))}
        {seg(d.outArr, d.inDep, "bg-emerald-400/70", "stay")}
        {seg(d.outDep, d.outArr, "bg-sky-500", "out")}
        {seg(d.inDep, d.inArr, "bg-sky-500", "back")}
      </div>
      <div className="mt-0.5 grid grid-cols-4 text-[10px] text-slate-400">
        {isos.map((iso) => (
          <span key={iso}>{wd(iso, intl)}</span>
        ))}
      </div>
    </div>
  );
}

/** Блок «Дешёвые выходные» наверху «Идей». Фильтры — в адресе (?w=пятница&m=plane|train). */
export default async function TripDeals({
  userId,
  t,
  intl,
  weekend,
  mode,
  saveLabel,
}: {
  userId: string;
  t: Dict["trp"];
  intl: string;
  weekend?: string;
  mode?: string;
  saveLabel: string;
}) {
  const weekends = upcomingWeekends();
  const prefs = await getTripPrefs(userId);
  const w = weekend && weekends.includes(weekend) ? weekend : weekends[0];
  const m = TRIP_MODES.includes(mode as TripMode) ? (mode as TripMode) : null;

  const [deals, check, updated] = await Promise.all([
    listTripOptions(prefs, { weekend: w, modes: m ? [m] : prefs.modes }),
    budgetChecker(userId),
    lastTripRefresh(),
  ]);
  const money = (n: number, c = "CZK") => formatMoney(n, c, intl);

  const href = (q: { w?: string; m?: TripMode | null }) => {
    const p = new URLSearchParams();
    const ww = q.w ?? w;
    const mm = q.m === undefined ? m : q.m;
    if (ww !== weekends[0]) p.set("w", ww);
    if (mm) p.set("m", mm);
    const s = p.toString();
    return s ? `/ideas?${s}#trips` : "/ideas#trips";
  };
  const chip = (active: boolean) =>
    `shrink-0 rounded-full px-3 py-1.5 text-sm ring-1 ${active ? "bg-emerald-50 font-semibold text-emerald-700 ring-emerald-300" : "text-slate-600 ring-slate-200"}`;
  const pill =
    "cursor-pointer rounded-full px-3 py-1.5 text-sm text-slate-600 ring-1 ring-slate-200 has-[:checked]:bg-emerald-50 has-[:checked]:font-semibold has-[:checked]:text-emerald-700 has-[:checked]:ring-emerald-300";

  return (
    <section id="trips" className="space-y-3">
      <div>
        <h2 className="text-lg font-semibold">✈️ {t.title}</h2>
        <p className="text-xs text-slate-500">
          {prefs.outSlots.map((s) => t.slot[s]).join(", ")} → {prefs.backSlots.map((s) => t.slot[s]).join(", ")} · {t.hoursOpt(prefs.minHours)} ·{" "}
          {t.upTo(money(prefs.maxPrice))}
        </p>
      </div>

      <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1">
        {weekends.map((fri) => (
          <Link key={fri} href={href({ w: fri })} className={chip(fri === w)}>
            {short(fri, intl)} – {short(weekendDays(fri).mon, intl)}
          </Link>
        ))}
      </div>
      <div className="flex flex-wrap gap-2">
        <Link href={href({ m: null })} className={chip(!m)}>
          {ICON.plane} {ICON.train}
        </Link>
        {TRIP_MODES.map((x) => (
          <Link key={x} href={href({ m: x })} className={chip(m === x)}>
            {ICON[x]} {t[x]}
          </Link>
        ))}
      </div>

      {!updated ? (
        <p className="rounded-2xl border border-dashed border-slate-300 p-4 text-center text-sm text-slate-500">{t.noData}</p>
      ) : deals.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-slate-300 p-4 text-center text-sm text-slate-500">{t.empty}</p>
      ) : (
        <ul className="space-y-2">
          {deals.slice(0, 15).map((d) => {
            const b = check?.(d);
            return (
              <li key={d.id} className={`${cardCls} p-3`}>
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate font-semibold">
                      {ICON[d.mode]} {d.destName}
                      {d.countryCode && <span className="ml-1 text-xs font-normal text-slate-400">{d.countryCode}</span>}
                    </p>
                    <p className="text-xs text-slate-500">
                      {d.source === "ryanair" ? "Ryanair" : "RegioJet"} · {t.arrive} {wd(d.outArr ?? d.outDep, intl)} {time(d.outArr)} → {t.leave}{" "}
                      {wd(d.inDep, intl)} {time(d.inDep)}
                    </p>
                  </div>
                  <p className="shrink-0 text-right font-semibold tabular-nums">
                    {money(Number(d.price), d.currency)}
                    <span className="block text-[11px] font-normal text-slate-400">{t.roundTrip}</span>
                  </p>
                </div>
                <Timeline d={d} intl={intl} />
                <div className="mt-1 flex flex-wrap items-center justify-between gap-2 text-xs">
                  <span>
                    <span className="font-medium text-emerald-700">{t.stay(d.hours, d.nights)}</span>
                    <span className="text-slate-400"> · {t.perHour(money(d.perHour, d.currency))}</span>
                  </span>
                  {b && <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${BADGE[b.state]}`}>{t[b.state]}</span>}
                </div>
                <div className="mt-2 flex gap-2">
                  <form action={addTripIdea}>
                    <input type="hidden" name="dealId" value={d.id} />
                    <button className={`${btnCls} px-3 py-1.5`}>💡 {t.toIdeas}</button>
                  </form>
                  <a href={d.url} target="_blank" rel="noopener noreferrer" className={`${btnGhostCls} px-3 py-1.5`}>
                    {t.open} ↗
                  </a>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      <details className={`${cardCls} p-3`}>
        <summary className="cursor-pointer text-sm font-medium text-slate-600">
          ⚙️ {t.settings}
          {updated && (
            <span className="ml-2 text-xs font-normal text-slate-400">
              · {t.updated}{" "}
              {new Intl.DateTimeFormat(intl, { timeZone: "Europe/Prague", day: "numeric", month: "numeric", hour: "2-digit", minute: "2-digit" }).format(updated)}
            </span>
          )}
        </summary>
        <form action={saveTripSettings} className="mt-3 space-y-4">
          <fieldset>
            <legend className={labelCls}>{t.outWhen}</legend>
            <div className="flex flex-wrap gap-2">
              {OUT_SLOT_KEYS.map((k) => (
                <label key={k} className={pill}>
                  <input type="checkbox" name={`out_${k}`} defaultChecked={prefs.outSlots.includes(k)} className="sr-only" />
                  {t.slot[k]}
                </label>
              ))}
            </div>
          </fieldset>
          <fieldset>
            <legend className={labelCls}>{t.backWhen}</legend>
            <div className="flex flex-wrap gap-2">
              {BACK_SLOT_KEYS.map((k) => (
                <label key={k} className={pill}>
                  <input type="checkbox" name={`back_${k}`} defaultChecked={prefs.backSlots.includes(k)} className="sr-only" />
                  {t.slot[k]}
                </label>
              ))}
            </div>
          </fieldset>
          <label className="block">
            <span className={labelCls}>{t.minHours}</span>
            <select name="minHours" defaultValue={String(HOURS.includes(prefs.minHours) ? prefs.minHours : 20)} className={inputCls}>
              {HOURS.map((h) => (
                <option key={h} value={h}>
                  {t.hoursOpt(h)}
                </option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className={labelCls}>{t.maxPrice} (CZK)</span>
            <input name="maxPrice" inputMode="numeric" defaultValue={String(prefs.maxPrice)} className={inputCls} />
          </label>
          <fieldset>
            <legend className={labelCls}>{t.sortBy}</legend>
            <div className="flex flex-wrap gap-2">
              {(["value", "price"] as const).map((v) => (
                <label key={v} className={pill}>
                  <input type="radio" name="sort" value={v} defaultChecked={prefs.sort === v} className="sr-only" />
                  {v === "value" ? t.sortValue : t.sortPrice}
                </label>
              ))}
            </div>
          </fieldset>
          <fieldset>
            <legend className={labelCls}>{t.modes}</legend>
            <div className="flex gap-4">
              {TRIP_MODES.map((x) => (
                <label key={x} className="flex items-center gap-2 text-sm">
                  <input type="checkbox" name={`mode_${x}`} defaultChecked={prefs.modes.includes(x)} />
                  {ICON[x]} {t[x]}
                </label>
              ))}
            </div>
          </fieldset>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" name="notify" defaultChecked={prefs.notify} />
            {t.notify}
          </label>
          <button className={`${btnCls} w-full`}>{saveLabel}</button>
        </form>
        <form action={refreshTripsNow} className="mt-3 border-t border-slate-100 pt-3">
          <button className={`${btnGhostCls} w-full`}>🔄 {t.refresh}</button>
          <p className="mt-1 text-center text-xs text-slate-400">{t.refreshHint}</p>
        </form>
      </details>
    </section>
  );
}
