import { notFound } from "next/navigation";
import CountUp from "@/components/CountUp";
import PageHeader from "@/components/PageHeader";
import { Card, cardCls, listCls } from "@/components/ui";
import { getI18n } from "@/i18n/server";
import { requireUser } from "@/lib/auth";
import { dividendCalendar } from "@/lib/dividends";
import { formatDate, formatMoney, monthLabel, todayISO } from "@/lib/forecast";
import { canUseInvest } from "@/lib/invest";

export const dynamic = "force-dynamic";

const short = (t: string) => t.replace(/_US_EQ$/, "").replace(/[a-z]?_EQ$/, "");

export default async function DividendsPage() {
  const user = await requireUser();
  if (!canUseInvest(user.id)) notFound();
  const { t, intl } = await getI18n();
  const today = todayISO("Europe/Prague");
  const cal = await dividendCalendar(user.id, today);

  if (!cal) {
    return (
      <>
        <PageHeader title={`💵 ${t.dv.title}`} />
        <p className="px-4 text-sm text-slate-500">{t.dv.noInvest}</p>
      </>
    );
  }
  const m = (n: number) => formatMoney(n, cal.base, intl);
  const max = Math.max(1, ...cal.months.map((x) => x.total));
  const upcoming = cal.events.slice(0, 12);

  return (
    <>
      <PageHeader title={`💵 ${t.dv.title}`} subtitle={t.dv.hint} />
      <div className="space-y-4 px-4">
        <Card>
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-sm text-slate-500">{t.dv.year}</p>
              <p className="text-3xl font-bold">
                ~<CountUp value={cal.yearTotal} currency={cal.base} locale={intl} />
              </p>
              <p className="text-sm text-slate-500">{t.dv.perMonth.replace("{x}", m(cal.yearTotal / 12))}</p>
            </div>
            {cal.yieldPct != null && (
              <div className="text-right">
                <p className="text-sm text-slate-500">{t.dv.yield}</p>
                <p className="text-xl font-semibold tabular-nums">{cal.yieldPct.toFixed(2)} %</p>
              </div>
            )}
          </div>

          <p className="mt-4 mb-1 text-xs font-medium text-slate-500">{t.dv.byMonth}</p>
          <div className="flex h-28 items-end gap-1">
            {cal.months.map((x, i) => (
              <div key={x.month} className="flex h-full flex-1 flex-col items-center justify-end gap-1">
                {x.total > 0 && <span className="text-[9px] tabular-nums text-slate-400">{Math.round(x.total)}</span>}
                <span
                  className={`cfp-col w-full rounded-t ${x.total > 0 ? "bg-emerald-500" : "bg-slate-100"}`}
                  style={{ height: x.total > 0 ? `${Math.max(6, (x.total / max) * 80)}%` : "4%", animationDelay: `${i * 40}ms` }}
                />
              </div>
            ))}
          </div>
          <div className="mt-1 flex gap-1 text-center text-[9px] text-slate-400">
            {cal.months.map((x) => (
              <span key={x.month} className="flex-1 truncate">
                {t.months[Number(x.month.slice(5, 7)) - 1].slice(0, 3)}
              </span>
            ))}
          </div>
        </Card>

        <section>
          <h2 className="mb-2 font-semibold">{t.dv.upcoming}</h2>
          {upcoming.length === 0 ? (
            <p className="text-sm text-slate-500">{t.dv.empty}</p>
          ) : (
            <ul className={`${listCls} ${cardCls} overflow-hidden`}>
              {upcoming.map((e, i) => (
                <li key={`${e.ticker}-${e.date}-${i}`} className="flex items-center justify-between gap-3 px-3 py-3">
                  <div className="min-w-0">
                    <p className="truncate font-medium">
                      {short(e.ticker)} <span className="font-normal text-slate-500">· {e.name}</span>
                    </p>
                    <p className="text-xs text-slate-500">
                      {formatDate(e.date, intl)} ·{" "}
                      <span className={e.announced ? "text-emerald-600" : ""}>{e.announced ? t.dv.announced : t.dv.estimated}</span>
                      {e.currency && ` · ${t.dv.perShare.replace("{x}", formatMoney(e.perShare, e.currency, intl))}`}
                    </p>
                  </div>
                  <span className="shrink-0 font-semibold tabular-nums text-emerald-700">+{m(e.totalBase)}</span>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section>
          <h2 className="mb-2 font-semibold">{t.dv.holdings}</h2>
          <ul className={`${listCls} ${cardCls} overflow-hidden`}>
            {cal.rows.map((r) => (
              <li key={r.ticker} className="flex items-center justify-between gap-3 px-3 py-3">
                <div className="min-w-0">
                  <p className="truncate font-medium">
                    {short(r.ticker)} <span className="font-normal text-slate-500">· {r.name}</span>
                  </p>
                  <p className="text-xs text-slate-500">
                    × {Number(r.quantity.toFixed(4))}
                    {r.frequency > 0 && ` · ${t.dv.times.replace("{n}", String(r.frequency))}`}
                    {r.yieldPct != null && r.perYearBase > 0 && ` · ${r.yieldPct.toFixed(2)} %`}
                  </p>
                </div>
                <span className={`shrink-0 text-sm tabular-nums ${r.perYearBase > 0 ? "font-medium" : "text-slate-400"}`}>
                  {r.perYearBase > 0 ? `~${m(r.perYearBase)}` : r.ok ? t.dv.none : t.dv.noData}
                </span>
              </li>
            ))}
          </ul>
          <p className="mt-2 text-xs text-slate-400">
            {formatDate(cal.takenAt.toISOString().slice(0, 10), intl)} · Trading 212 + Yahoo Finance · {monthLabel(today.slice(0, 7), t.months)}
          </p>
        </section>
      </div>
    </>
  );
}
