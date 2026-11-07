import { addFixedExpense, deleteFixedExpense } from "@/app/actions";
import { DayOfMonthPicker } from "@/components/DatePicker";
import PageHeader from "@/components/PageHeader";
import { BackLink, btnCls, Card, cardCls, CurrencySelect, inputCls, labelCls, listCls, XIcon } from "@/components/ui";
import { dayLabels } from "@/i18n/dictionaries";
import { getI18n } from "@/i18n/server";
import { requireUser } from "@/lib/auth";
import { getFixedExpenses, getProfile } from "@/lib/finance";
import { formatMoney } from "@/lib/forecast";

export const dynamic = "force-dynamic";

export default async function ExpensesPage() {
  const user = await requireUser();
  const { t, intl } = await getI18n();
  const [profile, items] = await Promise.all([getProfile(user.id), getFixedExpenses(user.id)]);
  const totals = new Map<string, number>();
  for (const i of items) totals.set(i.currency, (totals.get(i.currency) ?? 0) + Number(i.amount));

  return (
    <>
      <BackLink href="/more" label={t.more.title} />
      <PageHeader title={t.fixed.title} subtitle={t.fixed.hint} />
      <div className="space-y-4 px-4">
        {items.length === 0 ? (
          <p className="text-sm text-slate-500">{t.fixed.empty}</p>
        ) : (
          <ul className={`${listCls} ${cardCls} overflow-hidden text-sm`}>
            {items.map((i) => (
              <li key={i.id} className="flex items-center justify-between gap-2 px-4 py-2.5">
                <div className="min-w-0">
                  <p className="truncate font-medium">{i.name}</p>
                  {i.dayOfMonth && <p className="text-xs text-slate-400">{t.fixed.day}: {i.dayOfMonth}</p>}
                </div>
                <div className="flex shrink-0 items-center gap-3">
                  <span>{formatMoney(Number(i.amount), i.currency, intl)}</span>
                  <form action={deleteFixedExpense}>
                    <input type="hidden" name="id" value={i.id} />
                    <button aria-label={t.common.delete} className="rounded-lg p-1 text-slate-400 active:text-rose-600">
                      <XIcon />
                    </button>
                  </form>
                </div>
              </li>
            ))}
            <li className="flex justify-between bg-slate-50 px-4 py-2.5 font-semibold">
              <span>{t.fixed.perMonth}</span>
              <span>{[...totals].map(([c, v]) => formatMoney(v, c, intl)).join(" + ")}</span>
            </li>
          </ul>
        )}

        <Card>
          <form action={addFixedExpense} className="space-y-3">
            <div>
              <label className={labelCls}>{t.fixed.name}</label>
              <input name="name" required placeholder={t.fixed.placeholder} className={inputCls} />
            </div>
            <div className="grid grid-cols-[1fr_96px] gap-2">
              <div>
                <label className={labelCls}>{t.common.amount}</label>
                <input name="amount" inputMode="decimal" required className={inputCls} />
              </div>
              <div>
                <label className={labelCls}>{t.common.currency}</label>
                <CurrencySelect defaultValue={profile.baseCurrency} />
              </div>
            </div>
            <div>
              <label className={labelCls}>{t.fixed.day}</label>
              <DayOfMonthPicker name="day" labels={dayLabels(t)} />
            </div>
            <button className={`${btnCls} w-full`}>{t.common.add}</button>
          </form>
        </Card>
      </div>
    </>
  );
}
