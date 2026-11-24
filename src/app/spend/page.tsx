import Link from "next/link";
import { addSpending, saveBudgets } from "@/app/actions";
import CategoryPicker from "@/components/CategoryPicker";
import DatePicker from "@/components/DatePicker";
import { ListGroup, ListRow } from "@/components/ListRow";
import PageHeader from "@/components/PageHeader";
import OfflineForm from "@/components/OfflineForm";
import ReceiptInput from "@/components/ReceiptInput";
import { btnCls, Card, CurrencySelect, inputCls, labelCls } from "@/components/ui";
import { dateLabels } from "@/i18n/dictionaries";
import { getI18n } from "@/i18n/server";
import { requireUser } from "@/lib/auth";
import { CATEGORIES, CATEGORY_ICON, isCategory } from "@/lib/categories";
import { getProfile } from "@/lib/finance";
import { addMonths, formatDate, formatMoney, monthLabel, todayISO } from "@/lib/forecast";
import { monthBudget } from "@/lib/spending";

export const dynamic = "force-dynamic";

export default async function SpendPage({ searchParams }: { searchParams: Promise<{ m?: string }> }) {
  const user = await requireUser();
  const { t, intl } = await getI18n();
  const sp = await searchParams;
  const profile = await getProfile(user.id);
  const today = todayISO(profile.timezone ?? "Europe/Prague");
  const month = /^\d{4}-\d{2}$/.test(sp.m ?? "") ? sp.m! : today.slice(0, 7);
  const isCurrent = month === today.slice(0, 7);
  const b = await monthBudget(user.id, month);
  const m = (n: number) => formatMoney(n, b.base, intl);
  const pct = b.totalPlan > 0 ? Math.min(100, (b.total / b.totalPlan) * 100) : 0;
  const barCls = (spent: number, plan: number) =>
    plan <= 0 ? "bg-slate-400" : spent > plan ? "bg-rose-500" : spent > plan * 0.8 ? "bg-amber-500" : "bg-emerald-500";

  // Траты по дням.
  const byDay = new Map<string, typeof b.list>();
  for (const x of b.list) byDay.set(x.date, [...(byDay.get(x.date) ?? []), x]);

  return (
    <>
      <PageHeader title={`💸 ${t.sp.title}`} subtitle={t.sp.hint} />
      <div className="space-y-4 px-4">
        <div className="flex items-center justify-between">
          <Link href={`/spend?m=${addMonths(month, -1)}`} className="rounded-xl px-3 py-2 text-lg text-slate-500 active:bg-slate-100">
            ‹
          </Link>
          <h2 className="font-semibold">{monthLabel(month, t.months)}</h2>
          <Link
            href={`/spend?m=${addMonths(month, 1)}`}
            className={`rounded-xl px-3 py-2 text-lg text-slate-500 active:bg-slate-100 ${isCurrent ? "invisible" : ""}`}
          >
            ›
          </Link>
        </div>

        <Card>
          <div className="flex items-baseline justify-between">
            <span className="text-sm text-slate-500">{t.sp.spent}</span>
            {b.totalPlan > 0 && (
              <span className="text-sm text-slate-500">
                {t.sp.plan}: {m(b.totalPlan)}
              </span>
            )}
          </div>
          <p className="text-3xl font-bold tabular-nums">{m(b.total)}</p>
          {b.totalPlan > 0 && (
            <>
              <div className="mt-2 h-2.5 overflow-hidden rounded-full bg-slate-100">
                <div className={`h-full rounded-full ${barCls(b.total, b.totalPlan)}`} style={{ width: `${pct}%` }} />
              </div>
              <p className={`mt-1 text-sm ${b.total > b.totalPlan ? "text-rose-600" : "text-slate-500"}`}>
                {b.total > b.totalPlan ? t.sp.over.replace("{x}", m(b.total - b.totalPlan)) : t.sp.left.replace("{x}", m(b.totalPlan - b.total))}
              </p>
            </>
          )}
          {b.rows.length > 0 && (
            <ul className="mt-4 space-y-3">
              {b.rows.map((r) => (
                <li key={r.cat}>
                  <div className="flex items-baseline justify-between gap-2 text-sm">
                    <span className="truncate">
                      {CATEGORY_ICON[r.cat]} {t.cat[r.cat]}
                    </span>
                    <span className="shrink-0 tabular-nums">
                      <span className="font-medium">{m(r.spent)}</span>
                      <span className="text-slate-400"> / {r.plan > 0 ? m(r.plan) : t.sp.noPlan}</span>
                    </span>
                  </div>
                  {r.plan > 0 && (
                    <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-slate-100">
                      <div className={`h-full rounded-full ${barCls(r.spent, r.plan)}`} style={{ width: `${Math.min(100, (r.spent / r.plan) * 100)}%` }} />
                    </div>
                  )}
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card>
          <h2 className="mb-3 font-semibold">＋ {t.sp.quick}</h2>
          <OfflineForm action={addSpending} className="space-y-3" kind="spending" savedText={t.of.savedOffline}>
            <div className="grid grid-cols-[1fr_96px] gap-2">
              <div>
                <label className={labelCls}>{t.sp.amount}</label>
                <input name="amount" inputMode="decimal" required placeholder="0" className={`${inputCls} text-lg font-semibold`} />
              </div>
              <div>
                <label className={labelCls}>{t.common.currency}</label>
                <CurrencySelect defaultValue={b.base} />
              </div>
            </div>
            <div>
              <label className={labelCls}>{t.sp.category}</label>
              <CategoryPicker t={t.cat} />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className={labelCls}>{t.sp.date}</label>
                <DatePicker name="date" defaultValue={isCurrent ? today : `${month}-01`} labels={dateLabels(t)} required />
              </div>
              <div>
                <label className={labelCls}>{t.sp.note}</label>
                <input name="note" placeholder={t.sp.notePh} className={inputCls} />
              </div>
            </div>
            <ReceiptInput label={t.sp.receipt} />
            <button className={`${btnCls} w-full`}>{t.sp.add}</button>
          </OfflineForm>
        </Card>

        <section>
          <h2 className="mb-2 font-semibold">{t.sp.list}</h2>
          {b.list.length === 0 ? (
            <p className="text-sm text-slate-500">{t.sp.empty}</p>
          ) : (
            <div className="space-y-3">
              {[...byDay].map(([d, xs]) => (
                <div key={d}>
                  <p className="mb-1 text-xs font-medium text-slate-500">{formatDate(d, intl)}</p>
                  <ListGroup>
                    {xs.map((x) => (
                      <li key={x.id}>
                        <ListRow
                          href={`/spend/${x.id}?m=${month}`}
                          icon={isCategory(x.category) ? CATEGORY_ICON[x.category] : "✨"}
                          title={x.note || (isCategory(x.category) ? t.cat[x.category] : x.category)}
                          subtitle={`${isCategory(x.category) ? t.cat[x.category] : ""}${x.receiptType ? " · 📎" : ""}`}
                          right={<span className="shrink-0 font-medium tabular-nums">{formatMoney(Number(x.amount), x.currency, intl)}</span>}
                        />
                      </li>
                    ))}
                  </ListGroup>
                </div>
              ))}
            </div>
          )}
        </section>

        <details className="group" id="limits">
          <summary className="flex cursor-pointer list-none items-center justify-between rounded-2xl px-3 py-2.5 text-sm font-medium text-slate-500 ring-1 ring-slate-200 [&::-webkit-details-marker]:hidden">
            <span>🎯 {t.sp.limits}</span>
            <span className="transition group-open:rotate-180">▾</span>
          </summary>
          <Card className="mt-2">
            <p className="mb-3 text-xs text-slate-500">{t.sp.limitsHint}</p>
            <form action={saveBudgets} className="space-y-2">
              <input type="hidden" name="currency" value={b.base} />
              {CATEGORIES.map((c) => (
                <div key={c} className="grid grid-cols-[1fr_120px] items-center gap-2">
                  <span className="truncate text-sm">
                    {CATEGORY_ICON[c]} {t.cat[c]}
                  </span>
                  <input
                    name={`limit_${c}`}
                    inputMode="decimal"
                    defaultValue={b.limits.get(c) ?? ""}
                    placeholder="—"
                    className={`${inputCls} text-right`}
                  />
                </div>
              ))}
              <button className={`${btnCls} mt-2 w-full`}>{t.sp.saveLimits}</button>
            </form>
          </Card>
        </details>
      </div>
    </>
  );
}
