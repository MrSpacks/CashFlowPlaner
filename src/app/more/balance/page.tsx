import { desc, eq } from "drizzle-orm";
import { saveBalance } from "@/app/actions";
import DatePicker from "@/components/DatePicker";
import PageHeader from "@/components/PageHeader";
import { BackLink, Card, CurrencySelect, btnCls, inputCls, labelCls } from "@/components/ui";
import { db } from "@/db";
import { balanceSnapshots } from "@/db/schema";
import { dateLabels } from "@/i18n/dictionaries";
import { getI18n } from "@/i18n/server";
import { requireUser } from "@/lib/auth";
import { getProfile } from "@/lib/finance";
import { formatDate, formatMoney, todayISO } from "@/lib/forecast";

export const dynamic = "force-dynamic";

export default async function BalancePage() {
  const user = await requireUser();
  const { t, intl } = await getI18n();
  const profile = await getProfile(user.id);
  const history = await db
    .select()
    .from(balanceSnapshots)
    .where(eq(balanceSnapshots.ownerId, user.id))
    .orderBy(desc(balanceSnapshots.asOfDate), desc(balanceSnapshots.createdAt))
    .limit(10);
  const last = history[0];

  return (
    <>
      <BackLink href="/more" label={t.more.title} />
      <PageHeader title={t.balance.title} subtitle={t.balance.hint} />
      <div className="px-4">
        <Card>
          <form action={saveBalance} className="space-y-3">
            <div className="grid grid-cols-[1fr_110px] gap-2">
              <div>
                <label className={labelCls}>{t.common.amount}</label>
                <input
                  name="amount"
                  inputMode="decimal"
                  required
                  defaultValue={last ? Number(last.amount) : ""}
                  className={inputCls}
                />
              </div>
              <div>
                <label className={labelCls}>{t.common.currency}</label>
                <CurrencySelect defaultValue={last?.currency ?? profile.baseCurrency} />
              </div>
            </div>
            <div>
              <label className={labelCls}>{t.balance.date}</label>
              <DatePicker name="date" defaultValue={todayISO()} labels={dateLabels(t)} required />
            </div>
            <button className={`${btnCls} w-full`}>{t.common.save}</button>
          </form>
        </Card>

        {history.length > 0 && (
          <>
            <h2 className="mt-6 mb-2 text-sm font-medium text-slate-500">{t.balance.history}</h2>
            <ul className="divide-y divide-slate-100 overflow-hidden rounded-2xl bg-white text-sm shadow-sm ring-1 ring-slate-200">
              {history.map((h) => (
                <li key={h.id} className="flex justify-between px-4 py-2.5">
                  <span className="text-slate-500">{formatDate(h.asOfDate, intl)}</span>
                  <span className="font-medium">{formatMoney(Number(h.amount), h.currency, intl)}</span>
                </li>
              ))}
            </ul>
          </>
        )}
      </div>
    </>
  );
}
