import { and, eq } from "drizzle-orm";
import { notFound } from "next/navigation";
import { deleteExpenseItem, updateExpenseItem } from "@/app/actions";
import DatePicker from "@/components/DatePicker";
import PageHeader from "@/components/PageHeader";
import { BackLink, Card, CurrencySelect, btnCls, btnGhostCls, inputCls, labelCls } from "@/components/ui";
import { db } from "@/db";
import { expenseItems } from "@/db/schema";
import { dateLabels } from "@/i18n/dictionaries";
import { getI18n } from "@/i18n/server";
import { requireUser } from "@/lib/auth";
import { getEventAccess } from "@/lib/events";
import { getSplitData, payerOf } from "@/lib/split";

export const dynamic = "force-dynamic";

export default async function EditExpensePage({ params }: { params: Promise<{ id: string; itemId: string }> }) {
  const user = await requireUser();
  const { id, itemId } = await params;
  const access = await getEventAccess(id, user.id);
  if (!access?.canEdit || !/^[0-9a-f-]{36}$/i.test(itemId)) notFound();
  const { ev } = access;
  const [it] = await db
    .select()
    .from(expenseItems)
    .where(and(eq(expenseItems.id, itemId), eq(expenseItems.eventId, ev.id)))
    .limit(1);
  if (!it) notFound();

  const { t } = await getI18n();
  const { parts, shares } = await getSplitData([ev.id]);
  const multi = parts.length > 1;
  const itemShares = shares.filter((s) => s.expenseItemId === it.id);
  const inSplit = (pid: string) => itemShares.length === 0 || itemShares.some((s) => s.participantId === pid);
  const nameOf = (pid: string) => {
    const p = parts.find((x) => x.id === pid);
    return p ? (p.userId === user.id ? `${p.displayName} (${t.pt.you})` : p.displayName) : "—";
  };

  return (
    <div className="lg:max-w-2xl">
      <BackLink href={`/events/${ev.id}`} label={ev.title} />
      <PageHeader title={t.ev.editExpense} />
      <div className="space-y-4 px-4">
        <Card>
          <form action={updateExpenseItem} className="space-y-3">
            <input type="hidden" name="id" value={it.id} />
            <div>
              <label className={labelCls}>{t.ev.expenseName}</label>
              <input name="title" required defaultValue={it.title} className={inputCls} />
            </div>
            <div className="grid grid-cols-[1fr_96px] gap-2">
              <div>
                <label className={labelCls}>{t.common.amount}</label>
                <input name="amount" inputMode="decimal" required defaultValue={Number(it.amount)} className={inputCls} />
              </div>
              <div>
                <label className={labelCls}>{t.common.currency}</label>
                <CurrencySelect defaultValue={it.currency} />
              </div>
            </div>
            <div>
              <label className={labelCls}>{t.ev.dueDate}</label>
              <DatePicker name="due" defaultValue={it.dueDate} labels={dateLabels(t)} />
              <p className="mt-1 text-xs text-slate-400">{t.ev.dueHint}</p>
            </div>
            {multi && (
              <>
                <div>
                  <label className={labelCls}>{t.pt.payer}</label>
                  <select name="payer" defaultValue={payerOf(it, ev, parts) ?? undefined} className={inputCls}>
                    {parts.map((p) => (
                      <option key={p.id} value={p.id}>{nameOf(p.id)}</option>
                    ))}
                  </select>
                </div>
                <fieldset>
                  <legend className={labelCls}>{t.pt.splitBetween}</legend>
                  <div className="flex flex-wrap gap-2">
                    {parts.map((p) => (
                      <label key={p.id} className="cursor-pointer">
                        <input type="checkbox" name="split" value={p.id} defaultChecked={inSplit(p.id)} className="peer sr-only" />
                        <span className="inline-block rounded-full px-3 py-1 text-sm ring-1 ring-slate-300 peer-checked:bg-emerald-50 peer-checked:text-emerald-700 peer-checked:ring-emerald-400">
                          {nameOf(p.id)}
                        </span>
                      </label>
                    ))}
                  </div>
                </fieldset>
              </>
            )}
            {it.status !== "paid" && (
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" name="estimate" defaultChecked={it.isEstimate} className="h-5 w-5 accent-emerald-600" />
                {t.ev.estimate}
              </label>
            )}
            <button className={`${btnCls} w-full`}>{t.common.save}</button>
          </form>
        </Card>

        <form action={deleteExpenseItem}>
          <input type="hidden" name="id" value={it.id} />
          <input type="hidden" name="back" value="1" />
          <button className={`${btnGhostCls} w-full text-rose-600`}>{t.ev.deleteExpense}</button>
        </form>
      </div>
    </div>
  );
}
