import { addFixedExpense, deleteFixedExpense, updateFixedExpense } from "@/app/actions";
import { DayOfMonthPicker } from "@/components/DatePicker";
import PageHeader from "@/components/PageHeader";
import { BackLink, btnCls, btnGhostCls, Card, cardCls, CurrencySelect, inputCls, labelCls, listCls } from "@/components/ui";
import { dayLabels, type Dict } from "@/i18n/dictionaries";
import { getI18n } from "@/i18n/server";
import { requireUser } from "@/lib/auth";
import { CATEGORIES, CATEGORY_ICON, isCategory } from "@/lib/categories";
import { getFixedExpenses, getProfile } from "@/lib/finance";
import { formatMoney } from "@/lib/forecast";

export const dynamic = "force-dynamic";

type Item = { name: string; amount: string; currency: string; dayOfMonth: number | null; category: string | null };

/** Поля постоянного расхода — одни и те же для добавления и правки. */
function Fields({ t, item, base }: { t: Dict; item?: Item; base: string }) {
  return (
    <>
      <div>
        <label className={labelCls}>{t.fixed.name}</label>
        <input name="name" required defaultValue={item?.name} placeholder={t.fixed.placeholder} className={inputCls} />
      </div>
      <div className="grid grid-cols-[1fr_96px] gap-2">
        <div>
          <label className={labelCls}>{t.common.amount}</label>
          <input name="amount" inputMode="decimal" required defaultValue={item ? Number(item.amount) : undefined} className={inputCls} />
        </div>
        <div>
          <label className={labelCls}>{t.common.currency}</label>
          <CurrencySelect defaultValue={item?.currency ?? base} />
        </div>
      </div>
      <div>
        <label className={labelCls}>{t.fixed.category}</label>
        <select name="category" defaultValue={item?.category ?? ""} className={inputCls}>
          <option value="">{t.fixed.noCategory}</option>
          {CATEGORIES.map((c) => (
            <option key={c} value={c}>
              {CATEGORY_ICON[c]} {t.cat[c]}
            </option>
          ))}
        </select>
        <p className="mt-1 text-xs text-slate-400">{t.fixed.catHint}</p>
      </div>
      <div>
        <label className={labelCls}>{t.fixed.day}</label>
        <DayOfMonthPicker name="day" defaultValue={item?.dayOfMonth ?? undefined} labels={dayLabels(t)} />
      </div>
    </>
  );
}

export default async function ExpensesPage() {
  const user = await requireUser();
  const { t, intl } = await getI18n();
  const [profile, items] = await Promise.all([getProfile(user.id), getFixedExpenses(user.id)]);
  const base = profile.baseCurrency ?? "CZK";
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
              <li key={i.id}>
                <details className="group">
                  <summary className="flex cursor-pointer list-none items-center justify-between gap-2 px-4 py-3 active:bg-slate-50 [&::-webkit-details-marker]:hidden">
                    <div className="min-w-0">
                      <p className="truncate font-medium">
                        {isCategory(i.category) && `${CATEGORY_ICON[i.category]} `}
                        {i.name}
                      </p>
                      <p className="truncate text-xs text-slate-400">
                        {isCategory(i.category) ? t.cat[i.category] : i.dayOfMonth ? `${t.fixed.day}: ${i.dayOfMonth}` : ""}
                      </p>
                    </div>
                    <span className="flex shrink-0 items-center gap-2">
                      <span className="tabular-nums">{formatMoney(Number(i.amount), i.currency, intl)}</span>
                      <span className="text-slate-300 transition group-open:rotate-90">›</span>
                    </span>
                  </summary>
                  <div className="space-y-3 border-t border-slate-100 bg-slate-50/50 px-4 py-3">
                    <form action={updateFixedExpense} className="space-y-3">
                      <input type="hidden" name="id" value={i.id} />
                      <Fields t={t} item={i} base={base} />
                      <button className={`${btnCls} w-full`}>{t.sp.save}</button>
                    </form>
                    <form action={deleteFixedExpense}>
                      <input type="hidden" name="id" value={i.id} />
                      <button className={`${btnGhostCls} w-full text-rose-600`}>{t.common.delete}</button>
                    </form>
                  </div>
                </details>
              </li>
            ))}
            <li className="flex justify-between bg-slate-50 px-4 py-2.5 font-semibold">
              <span>{t.fixed.perMonth}</span>
              <span>{[...totals].map(([c, v]) => formatMoney(v, c, intl)).join(" + ")}</span>
            </li>
          </ul>
        )}

        <Card>
          <h2 className="mb-3 font-semibold">＋ {t.common.add}</h2>
          <form action={addFixedExpense} className="space-y-3">
            <Fields t={t} base={base} />
            <button className={`${btnCls} w-full`}>{t.common.add}</button>
          </form>
        </Card>
      </div>
    </>
  );
}
