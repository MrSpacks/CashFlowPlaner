import { and, eq } from "drizzle-orm";
import { notFound } from "next/navigation";
import { deleteSpending, updateSpending } from "@/app/actions";
import CategoryPicker from "@/components/CategoryPicker";
import DatePicker from "@/components/DatePicker";
import PageHeader from "@/components/PageHeader";
import ReceiptInput from "@/components/ReceiptInput";
import { BackLink, btnCls, btnGhostCls, Card, CurrencySelect, inputCls, labelCls } from "@/components/ui";
import { db } from "@/db";
import { spendings } from "@/db/schema";
import { dateLabels } from "@/i18n/dictionaries";
import { getI18n } from "@/i18n/server";
import { requireUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function SpendEditPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ m?: string }> }) {
  const user = await requireUser();
  const { t } = await getI18n();
  const { id } = await params;
  const { m } = await searchParams;
  const [x] = await db
    .select({
      id: spendings.id,
      date: spendings.date,
      amount: spendings.amount,
      currency: spendings.currency,
      category: spendings.category,
      note: spendings.note,
      receiptType: spendings.receiptType,
    })
    .from(spendings)
    .where(and(eq(spendings.id, id), eq(spendings.ownerId, user.id)))
    .limit(1);
  if (!x) notFound();
  const back = `/spend${/^\d{4}-\d{2}$/.test(m ?? "") ? `?m=${m}` : ""}`;

  return (
    <>
      <BackLink href={back} label={t.sp.title} />
      <PageHeader title={t.sp.edit} />
      <div className="space-y-4 px-4">
        <Card>
          <form action={updateSpending} className="space-y-3">
            <input type="hidden" name="id" value={x.id} />
            <input type="hidden" name="back" value={back} />
            <div className="grid grid-cols-[1fr_96px] gap-2">
              <div>
                <label className={labelCls}>{t.sp.amount}</label>
                <input name="amount" inputMode="decimal" required defaultValue={Number(x.amount)} className={`${inputCls} text-lg font-semibold`} />
              </div>
              <div>
                <label className={labelCls}>{t.common.currency}</label>
                <CurrencySelect defaultValue={x.currency} />
              </div>
            </div>
            <div>
              <label className={labelCls}>{t.sp.category}</label>
              <CategoryPicker t={t.cat} defaultValue={x.category} />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className={labelCls}>{t.sp.date}</label>
                <DatePicker name="date" defaultValue={x.date} labels={dateLabels(t)} required />
              </div>
              <div>
                <label className={labelCls}>{t.sp.note}</label>
                <input name="note" defaultValue={x.note ?? ""} placeholder={t.sp.notePh} className={inputCls} />
              </div>
            </div>
            <ReceiptInput label={t.sp.receipt} existingUrl={x.receiptType ? `/api/receipt/${x.id}` : null} />
            <button className={`${btnCls} w-full`}>{t.sp.save}</button>
          </form>
          <form action={deleteSpending} className="mt-2">
            <input type="hidden" name="id" value={x.id} />
            <input type="hidden" name="back" value={back} />
            <button className={`${btnGhostCls} w-full text-rose-600`}>{t.common.delete}</button>
          </form>
        </Card>
      </div>
    </>
  );
}
