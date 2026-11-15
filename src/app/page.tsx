import Link from "next/link";
import IncomingInvites from "@/components/IncomingInvites";
import PageHeader from "@/components/PageHeader";
import { btnCls, Card, cardBaseCls } from "@/components/ui";
import { getI18n } from "@/i18n/server";
import { requireUser } from "@/lib/auth";
import { buildUserForecast } from "@/lib/finance";
import { formatMoney, monthLabel, todayISO } from "@/lib/forecast";
import { getReminders } from "@/lib/reminders";
import { canUseDailyPlan, getDailyPlan, planProgress, userToday } from "@/lib/dailyPlan";
import { canUseInvest, latestSnapshot } from "@/lib/invest";
import { canUseTrips, getTripPrefs, listTripDeals, upcomingWeekends } from "@/lib/trips";

export const dynamic = "force-dynamic";

const stateStyle = {
  ok: { ring: "ring-emerald-200", badge: "bg-emerald-100 text-emerald-700" },
  tight: { ring: "ring-amber-200", badge: "bg-amber-100 text-amber-700" },
  negative: { ring: "ring-rose-300", badge: "bg-rose-100 text-rose-700" },
} as const;

export default async function ForecastPage() {
  const user = await requireUser();
  const { t, intl } = await getI18n();
  const [f, reminders] = await Promise.all([buildUserForecast(user.id), getReminders(user.id, todayISO(), 7, 7)]);
  const plan = canUseDailyPlan(user.id) ? await getDailyPlan(user.id, await userToday(user.id)) : null;
  const planProg = plan ? planProgress(plan) : null;
  const inv = canUseInvest(user.id) ? await latestSnapshot(user.id) : null;

  // «На выходных»: самый дешёвый билет ближайших выходных в пределах цены.
  let trip: Awaited<ReturnType<typeof listTripDeals>>[number] | null = null;
  if (canUseTrips(user.id)) {
    const prefs = await getTripPrefs(user.id);
    trip = (await listTripDeals({ modes: prefs.modes, maxPrice: prefs.maxPrice, weekend: upcomingWeekends()[0] }))[0] ?? null;
  }

  // Ряд плиток сверху: план дня, инвестиции, билеты. Каждая ведёт в свой раздел.
  const tileCls = "flex min-w-0 flex-col rounded-2xl bg-white p-3 shadow-sm ring-1 ring-slate-200 active:bg-slate-50";
  const tiles: React.ReactNode[] = [];
  if (plan && planProg) {
    tiles.push(
      <Link key="plan" href="/plan" className={tileCls}>
        <span className="truncate text-xs text-slate-500">📋 {t.dp.menu}</span>
        <span className="mt-1 text-lg font-semibold tabular-nums">
          {planProg.done}/{planProg.total}
        </span>
      </Link>,
    );
  }
  if (inv) {
    const pl = Number(inv.unrealizedPl);
    tiles.push(
      <Link key="inv" href="/more/invest" className={tileCls}>
        <span className="truncate text-xs text-slate-500">📈 {t.inv.home}</span>
        <span className="mt-1 truncate text-base font-semibold tabular-nums">{formatMoney(Number(inv.totalValue), inv.currency, intl)}</span>
        {Number(inv.totalCost) > 0 && (
          <span className={`text-xs font-medium tabular-nums ${pl < 0 ? "text-rose-600" : "text-emerald-700"}`}>
            {pl >= 0 ? "+" : ""}
            {((pl / Number(inv.totalCost)) * 100).toFixed(1)} %
          </span>
        )}
      </Link>,
    );
  }
  if (trip) {
    tiles.push(
      <Link key="trip" href="/ideas#trips" className={tileCls}>
        <span className="truncate text-xs text-slate-500">
          {trip.mode === "plane" ? "✈️" : "🚆"} {t.trp.home}
        </span>
        <span className="mt-1 truncate text-base font-semibold tabular-nums">{formatMoney(Number(trip.price), trip.currency, intl)}</span>
        <span className="truncate text-xs text-slate-500">{trip.destName}</span>
      </Link>,
    );
  }
  const tilesRow = tiles.length > 0 && (
    <div className={`mx-4 mb-4 grid gap-2 ${tiles.length === 1 ? "grid-cols-1" : tiles.length === 2 ? "grid-cols-2" : "grid-cols-3"}`}>{tiles}</div>
  );
  const money = (n: number) => formatMoney(n, f.base, intl);

  if (f.isEmpty) {
    return (
      <>
        <PageHeader title={t.forecast.title} subtitle={t.forecast.subtitle} />
        {tilesRow}
      <IncomingInvites userId={user.id} t={t.sh} />
        <div className="px-4">
          <Card>
            <h2 className="text-lg font-semibold">{t.forecast.setupTitle}</h2>
            <p className="mt-1 text-sm text-slate-500">{t.forecast.setupText}</p>
            <div className="mt-4 grid gap-2">
              <Link href="/more/balance" className={btnCls}>1. {t.more.balance}</Link>
              <Link href="/more/income" className={btnCls}>2. {t.more.incomes}</Link>
              <Link href="/more/expenses" className={btnCls}>3. {t.more.fixed}</Link>
            </div>
          </Card>
        </div>
      </>
    );
  }

  return (
    <>
      <PageHeader
        title={t.forecast.title}
        subtitle={
          f.snapshot
            ? t.forecast.now(formatMoney(Number(f.snapshot.amount), f.snapshot.currency, intl))
            : t.forecast.subtitle
        }
      />
      {tilesRow}
      <IncomingInvites userId={user.id} t={t.sh} />
      {reminders.length > 0 && (
        <div className="mx-4 mb-4 rounded-2xl bg-amber-50 p-4 ring-1 ring-amber-200">
          <h2 className="mb-2 text-sm font-semibold text-amber-900">🔔 {t.rm.title}</h2>
          <ul className="space-y-1.5 text-sm">
            {reminders.slice(0, 6).map((r, i) => (
              <li key={`${r.eventId}-${i}`}>
                <Link href={`/events/${r.eventId}`} className="flex items-baseline justify-between gap-2">
                  <span className="min-w-0 truncate">
                    <span className={r.kind === "overdue" ? "font-semibold text-rose-600" : "text-amber-800"}>
                      {r.kind === "overdue" ? t.rm.overdue : r.kind === "due" ? t.rm.due : t.rm.event} {t.rm.when(r.days)}:
                    </span>{" "}
                    {r.title}
                  </span>
                  {r.amount != null && <span className="shrink-0 font-medium">{formatMoney(r.amount, r.currency, intl)}</span>}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}
      <ul className="space-y-3 px-4 lg:grid lg:grid-cols-2 lg:gap-4 lg:space-y-0 xl:grid-cols-3">
        {f.months.map((mo) => {
          const s = stateStyle[mo.state];
          return (
            <li key={mo.month} className={`relative ${cardBaseCls} p-4 transition active:scale-[0.99] ${s.ring}`}>
              {/* Вся карточка ведёт в календарь этого месяца */}
              <Link href={`/calendar?m=${mo.month}`} aria-label={monthLabel(mo.month, t.months)} className="absolute inset-0 rounded-2xl" />
              <div className="flex items-center justify-between gap-2">
                <h2 className="font-semibold">{monthLabel(mo.month, t.months)} <span className="text-slate-400">›</span></h2>
                <span className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${s.badge}`}>{t.forecast[mo.state]}</span>
              </div>
              <dl className="mt-3 grid grid-cols-3 gap-2 text-sm">
                <div className="min-w-0">
                  <dt className="text-slate-500">{t.forecast.incoming}</dt>
                  <dd className="truncate font-medium text-emerald-700">{money(mo.income + mo.refunds)}</dd>
                  {mo.incomeMissing && (
                    <dd className="relative z-10 text-xs text-amber-600">
                      <Link href="/more/income">{t.forecast.notSet}</Link>
                    </dd>
                  )}
                </div>
                <div className="min-w-0">
                  <dt className="text-slate-500">{t.forecast.outgoing}</dt>
                  <dd className="truncate font-medium text-slate-800">{money(mo.fixed + mo.eventPayments)}</dd>
                </div>
                <div className="min-w-0 text-right">
                  <dt className="text-slate-500">{t.forecast.total}</dt>
                  <dd className={`truncate font-bold ${mo.closing < 0 ? "text-rose-600" : "text-slate-900"}`}>{money(mo.closing)}</dd>
                </div>
              </dl>
              {(() => {
                const net = mo.income + mo.refunds - mo.fixed - mo.eventPayments;
                return (
                  <p className="mt-2 flex items-baseline justify-between border-t border-slate-100 pt-2 text-sm">
                    <span className="text-slate-500">{t.forecast.monthNet}</span>
                    <span className={`font-semibold ${net < 0 ? "text-rose-600" : "text-emerald-700"}`}>
                      {net > 0 ? "+" : net < 0 ? "−" : ""}
                      {money(Math.abs(net))}
                    </span>
                  </p>
                );
              })()}
              {mo.movable.length > 0 && (
                <p className="mt-3 rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-600">
                  {t.forecast.movable}: {mo.movable.map((x) => `${x.title} (${money(x.amount)})`).join(", ")}
                </p>
              )}
            </li>
          );
        })}
      </ul>
    </>
  );
}
