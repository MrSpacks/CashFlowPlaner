import { addIncomeSource, addOneTimeIncome, deleteIncomeSource, deleteOneTimeIncome, saveIncomeMonth } from "@/app/actions";
import DatePicker, { DayOfMonthPicker } from "@/components/DatePicker";
import PageHeader from "@/components/PageHeader";
import { BackLink, btnCls, Card, CurrencySelect, inputCls, labelCls, listCls, XIcon } from "@/components/ui";
import { dateLabels, dayLabels } from "@/i18n/dictionaries";
import { getI18n } from "@/i18n/server";
import { requireUser } from "@/lib/auth";
import { getIncomeData, getLatestBalance, getOneTimeIncomes, getProfile, oneTimeCounts } from "@/lib/finance";
import { addMonths, formatDate, formatMoney, monthLabel, todayISO } from "@/lib/forecast";

export const dynamic = "force-dynamic";

const MONTHS_SHOWN = 6;

export default async function IncomePage() {
  const user = await requireUser();
  const { t, intl } = await getI18n();
  const [profile, { sources, rows }, oneTime, snap] = await Promise.all([getProfile(user.id), getIncomeData(user.id), getOneTimeIncomes(user.id), getLatestBalance(user.id)]);
  const start = todayISO().slice(0, 7);
  const months = Array.from({ length: MONTHS_SHOWN }, (_, i) => addMonths(start, i));
  const smallInput =
    "w-full min-w-0 rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-sm outline-none focus:border-emerald-500";

  return (
    <>
      <BackLink href="/more" label={t.more.title} />
      <PageHeader title={t.income.title} subtitle={t.income.hint} />
      <div className="space-y-4 px-4">
        {sources.length === 0 && <p className="text-sm text-slate-500">{t.income.empty}</p>}

        {sources.map((s) => (
          <Card key={s.id}>
            <div className="mb-3 flex items-start justify-between gap-2">
              <div className="min-w-0">
                <h2 className="truncate font-semibold">{s.name}</h2>
                <p className="text-xs text-slate-500">
                  {s.isFixed && s.defaultAmount
                    ? `${t.income.fixed}: ${formatMoney(Number(s.defaultAmount), s.currency, intl)}`
                    : s.currency}
                  {s.payDay ? ` · ${t.income.payDay}: ${s.payDay}` : ""}
                </p>
              </div>
              <form action={deleteIncomeSource}>
                <input type="hidden" name="id" value={s.id} />
                <button className="text-xs text-slate-400 active:text-rose-600">{t.income.deleteSource}</button>
              </form>
            </div>

            <div className="grid grid-cols-[1fr_1fr_1fr_auto] items-center gap-x-2 gap-y-1 text-xs text-slate-500">
              <span />
              <span>{t.income.expected}</span>
              <span>{t.income.actual}</span>
              <span />
            </div>
            <div className="space-y-1.5">
              {months.map((m) => {
                const row = rows.find((r) => r.sourceId === s.id && r.month.startsWith(m));
                const auto = !row?.expectedAmount && s.isFixed && s.defaultAmount;
                return (
                  <form key={m} action={saveIncomeMonth} className="grid grid-cols-[1fr_1fr_1fr_auto] items-center gap-2">
                    <input type="hidden" name="sourceId" value={s.id} />
                    <input type="hidden" name="month" value={m} />
                    <span className="truncate text-sm">{monthLabel(m, t.months).replace(/ \d{4}$/, "")}</span>
                    <input
                      name="expected"
                      inputMode="decimal"
                      defaultValue={row?.expectedAmount ? Number(row.expectedAmount) : ""}
                      placeholder={auto ? `${Number(s.defaultAmount)} ${t.income.autoFilled}` : ""}
                      className={smallInput}
                    />
                    <input
                      name="actual"
                      inputMode="decimal"
                      defaultValue={row?.actualAmount ? Number(row.actualAmount) : ""}
                      className={smallInput}
                    />
                    <button aria-label={t.common.save} className="rounded-lg bg-emerald-600 p-1.5 text-white active:bg-emerald-700">
                      <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2.5}>
                        <path d="M5 12l5 5L20 7" />
                      </svg>
                    </button>
                  </form>
                );
              })}
            </div>
          </Card>
        ))}

        <Card>
          <h2 className="mb-3 font-semibold">{t.income.addSource}</h2>
          <form action={addIncomeSource} className="space-y-3">
            <div>
              <label className={labelCls}>{t.income.name}</label>
              <input name="name" required placeholder={t.income.placeholder} className={inputCls} />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className={labelCls}>{t.income.payDay}</label>
                <DayOfMonthPicker name="payDay" labels={dayLabels(t)} />
              </div>
              <div>
                <label className={labelCls}>{t.common.currency}</label>
                <CurrencySelect defaultValue={profile.baseCurrency} />
              </div>
            </div>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" name="isFixed" className="h-5 w-5 accent-emerald-600" />
              {t.income.fixed}
            </label>
            <div>
              <label className={labelCls}>{t.income.defaultAmount}</label>
              <input name="amount" inputMode="decimal" className={inputCls} />
            </div>
            <button className={`${btnCls} w-full`}>{t.common.add}</button>
          </form>
        </Card>

        <section id="one-time" className="scroll-mt-4">
          <Card>
            <h2 className="font-semibold">💰 {t.income.oneTime}</h2>
            <p className="mb-3 text-xs text-slate-500">{t.income.oneTimeHint}</p>
            {oneTime.length === 0 ? (
              <p className="mb-3 text-sm text-slate-500">{t.income.oneTimeEmpty}</p>
            ) : (
              <ul className={`${listCls} mb-3 text-sm`}>
                {oneTime.map((o) => (
                  <li key={o.id} className="flex items-center justify-between gap-2 py-2">
                    <div className="min-w-0">
                      <p className="truncate font-medium">{o.title}</p>
                      <p className="text-xs text-slate-400">{formatDate(o.date, intl)}</p>
                      {!oneTimeCounts(o, snap) && <p className="text-xs text-amber-600">{t.income.inBalance}</p>}
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      <span className="font-medium text-emerald-700">+{formatMoney(Number(o.amount), o.currency, intl)}</span>
                      <form action={deleteOneTimeIncome}>
                        <input type="hidden" name="id" value={o.id} />
                        <button aria-label={t.common.delete} className="p-1 text-slate-300 active:text-rose-600">
                          <XIcon />
                        </button>
                      </form>
                    </div>
                  </li>
                ))}
              </ul>
            )}
            <form action={addOneTimeIncome} className="space-y-3">
              <div>
                <label className={labelCls}>{t.income.name}</label>
                <input name="title" required placeholder={t.income.oneTimePlaceholder} className={inputCls} />
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
                <label className={labelCls}>{t.income.date}</label>
                <DatePicker name="date" defaultValue={todayISO()} labels={dateLabels(t)} required />
              </div>
              <button className={`${btnCls} w-full`}>{t.common.add}</button>
            </form>
          </Card>
        </section>
      </div>
    </>
  );
}
