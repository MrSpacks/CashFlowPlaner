import { eq } from "drizzle-orm";
import { addPersonalReminder, deletePersonalReminder, updatePersonalReminder } from "@/app/actions";
import PageHeader from "@/components/PageHeader";
import TimesField from "@/components/TimesField";
import { BackLink, Card, btnCls, btnGhostCls, inputCls, labelCls } from "@/components/ui";
import { db } from "@/db";
import { pushSubscriptions } from "@/db/schema";
import { getI18n } from "@/i18n/server";
import { requireUser } from "@/lib/auth";
import { listPersonalReminders } from "@/lib/personalReminders";

export const dynamic = "force-dynamic";

export default async function RemindersPage() {
  const user = await requireUser();
  const { t } = await getI18n();
  const [list, subs] = await Promise.all([
    listPersonalReminders(user.id),
    db.select({ id: pushSubscriptions.id }).from(pushSubscriptions).where(eq(pushSubscriptions.userId, user.id)).limit(1),
  ]);

  return (
    <>
      <BackLink href="/more" label={t.more.title} />
      <PageHeader title={`⏰ ${t.prm.title}`} subtitle={t.prm.hint} />
      <div className="space-y-4 px-4">
        {subs.length === 0 && <p className="rounded-xl bg-amber-50 px-3 py-2 text-sm text-amber-800">{t.prm.needPush}</p>}

        {list.length === 0 && <p className="text-sm text-slate-500">{t.prm.empty}</p>}

        {list.map((r) => (
          <Card key={r.id}>
            <form action={updatePersonalReminder} className="space-y-3">
              <input type="hidden" name="id" value={r.id} />
              <div>
                <label className={labelCls}>{t.prm.name}</label>
                <input name="title" required defaultValue={r.title} className={inputCls} />
              </div>
              <div>
                <label className={labelCls}>{t.prm.times}</label>
                <TimesField initial={r.times} addLabel={t.prm.addTime} />
              </div>
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" name="enabled" defaultChecked={r.enabled} className="h-5 w-5 accent-emerald-600" />
                {t.prm.enabled}
              </label>
              <button className={`${btnCls} w-full`}>{t.prm.save}</button>
            </form>
            <form action={deletePersonalReminder} className="mt-2">
              <input type="hidden" name="id" value={r.id} />
              <button className={`${btnGhostCls} w-full text-rose-600`}>{t.common.delete}</button>
            </form>
          </Card>
        ))}

        <Card>
          <h2 className="mb-3 font-semibold">＋ {t.prm.add}</h2>
          <form action={addPersonalReminder} className="space-y-3">
            <div>
              <label className={labelCls}>{t.prm.name}</label>
              <input name="title" required placeholder={t.prm.namePh} className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>{t.prm.times}</label>
              <TimesField initial={["08:00", "12:00", "16:00", "20:00"]} addLabel={t.prm.addTime} />
            </div>
            <button className={`${btnCls} w-full`}>{t.prm.add}</button>
          </form>
        </Card>
      </div>
    </>
  );
}
