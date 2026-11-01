import Link from "next/link";
import PageHeader from "@/components/PageHeader";
import { Card, btnCls } from "@/components/ui";
import { getI18n } from "@/i18n/server";
import { requireUser } from "@/lib/auth";
import { buildUserForecast } from "@/lib/finance";
import { formatDate, formatMoney, monthLabel } from "@/lib/forecast";

export const dynamic = "force-dynamic";

const stateStyle = {
  ok: { ring: "ring-emerald-200", badge: "bg-emerald-100 text-emerald-700" },
  tight: { ring: "ring-amber-200", badge: "bg-amber-100 text-amber-700" },
  negative: { ring: "ring-rose-300", badge: "bg-rose-100 text-rose-700" },
} as const;

export default async function ForecastPage() {
  const user = await requireUser();
  const { t, intl } = await getI18n();
  const f = await buildUserForecast(user.id);
  const money = (n: number) => formatMoney(n, f.base, intl);

  if (f.isEmpty) {
    return (
      <>
        <PageHeader title={t.forecast.title} subtitle={t.forecast.subtitle} />
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
            ? t.forecast.now(formatMoney(Number(f.snapshot.amount), f.snapshot.currency, intl), formatDate(f.snapshot.asOfDate, intl))
            : t.forecast.subtitle
        }
      />
      <ul className="space-y-3 px-4">
        {f.months.map((mo) => {
          const s = stateStyle[mo.state];
          return (
            <li key={mo.month} className={`rounded-2xl bg-white p-4 shadow-sm ring-1 ${s.ring}`}>
              <div className="flex items-center justify-between gap-2">
                <h2 className="font-semibold">{monthLabel(mo.month, t.months)}</h2>
                <span className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${s.badge}`}>{t.forecast[mo.state]}</span>
              </div>
              <dl className="mt-3 grid grid-cols-3 gap-2 text-sm">
                <div className="min-w-0">
                  <dt className="text-slate-500">{t.forecast.incoming}</dt>
                  <dd className="truncate font-medium text-emerald-700">{money(mo.income + mo.refunds)}</dd>
                  {mo.incomeMissing && (
                    <dd className="text-xs text-amber-600">
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
            </li>
          );
        })}
      </ul>
    </>
  );
}
