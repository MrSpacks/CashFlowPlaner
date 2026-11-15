import Link from "next/link";
import { addTripIdea, saveTripSettings } from "@/app/actions";
import { btnCls, btnGhostCls, cardCls, inputCls, labelCls } from "@/components/ui";
import type { Dict } from "@/i18n/dictionaries";
import { formatMoney } from "@/lib/forecast";
import {
  budgetChecker,
  getTripPrefs,
  listTripDeals,
  TRIP_MODES,
  upcomingWeekends,
  weekendDays,
  type Budget,
  type TripMode,
} from "@/lib/trips";

const BADGE: Record<Budget, string> = {
  ok: "bg-emerald-100 text-emerald-700",
  tight: "bg-amber-100 text-amber-700",
  negative: "bg-rose-100 text-rose-700",
};
const ICON: Record<TripMode, string> = { plane: "✈️", train: "🚆" };

const time = (s: string | null) => (s ? s.slice(11, 16) : "");
const short = (iso: string, intl: string) =>
  new Intl.DateTimeFormat(intl, { timeZone: "UTC", day: "numeric", month: "short" }).format(new Date(`${iso}T12:00:00Z`));
const day = (s: string, intl: string) =>
  new Intl.DateTimeFormat(intl, { timeZone: "UTC", weekday: "short" }).format(new Date(`${s.slice(0, 10)}T12:00:00Z`));

/** Блок «Дешёвые выходные» наверху «Идей». Фильтры — в адресе (?w=пятница&m=plane|train). */
export default async function TripDeals({
  userId,
  t,
  intl,
  weekend,
  mode,
  saveLabel,
}: {
  saveLabel: string;
  userId: string;
  t: Dict["trp"];
  intl: string;
  weekend?: string;
  mode?: string;
}) {
  const weekends = upcomingWeekends();
  const prefs = await getTripPrefs(userId);
  const w = weekend && weekends.includes(weekend) ? weekend : weekends[0];
  const m = TRIP_MODES.includes(mode as TripMode) ? (mode as TripMode) : null;
  const modes = m ? [m] : prefs.modes;

  const [all, check] = await Promise.all([listTripDeals({ modes }), budgetChecker(userId)]);
  const deals = all.filter((d) => d.weekend === w && Number(d.price) <= prefs.maxPrice);
  const updated = all.reduce<Date | null>((a, d) => (!a || d.fetchedAt > a ? d.fetchedAt : a), null);
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

  return (
    <section id="trips" className="space-y-3">
      <div>
        <h2 className="text-lg font-semibold">✈️ {t.title}</h2>
        <p className="text-xs text-slate-500">{t.hint}</p>
      </div>

      <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1">
        {weekends.map((fri) => {
          const d = weekendDays(fri);
          return (
            <Link key={fri} href={href({ w: fri })} className={chip(fri === w)}>
              {short(d.fri, intl)} – {short(d.sun, intl)}
            </Link>
          );
        })}
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
        <span className="self-center text-sm text-slate-500">{t.upTo(money(prefs.maxPrice))}</span>
      </div>

      {all.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-slate-300 p-4 text-center text-sm text-slate-500">{t.noData}</p>
      ) : deals.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-slate-300 p-4 text-center text-sm text-slate-500">{t.empty}</p>
      ) : (
        <ul className="space-y-2">
          {deals.slice(0, 15).map((d) => {
            const b = check?.(d);
            return (
              <li key={d.id} className={`${cardCls} p-3`}>
                <div className="flex items-baseline justify-between gap-3">
                  <p className="min-w-0 truncate font-semibold">
                    {ICON[d.mode]} {d.destName}
                    {d.countryCode && <span className="ml-1 text-xs font-normal text-slate-400">{d.countryCode}</span>}
                  </p>
                  <p className="shrink-0 text-right font-semibold tabular-nums">
                    {money(Number(d.price), d.currency)}
                    <span className="block text-[11px] font-normal text-slate-400">{t.roundTrip}</span>
                  </p>
                </div>
                <div className="mt-1 flex items-center justify-between gap-2">
                  <p className="min-w-0 text-xs text-slate-500">
                    {d.source === "ryanair" ? "Ryanair" : "RegioJet"} · {day(d.outDep, intl)} {time(d.outDep)} → {day(d.inDep, intl)} {time(d.inDep)}
                  </p>
                  {b && <span className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-medium ${BADGE[b.state]}`}>{t[b.state]}</span>}
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
              · {t.updated} {new Intl.DateTimeFormat(intl, { timeZone: "Europe/Prague", day: "numeric", month: "numeric", hour: "2-digit", minute: "2-digit" }).format(updated)}
            </span>
          )}
        </summary>
        <form action={saveTripSettings} className="mt-3 space-y-3">
          <label className="block">
            <span className={labelCls}>{t.maxPrice} (CZK)</span>
            <input name="maxPrice" inputMode="numeric" defaultValue={String(prefs.maxPrice)} className={inputCls} />
          </label>
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
      </details>
    </section>
  );
}
