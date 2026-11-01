import { createEvent } from "@/app/actions";
import EventList from "@/components/EventList";
import PageHeader from "@/components/PageHeader";
import { btnCls, inputCls } from "@/components/ui";
import { getI18n } from "@/i18n/server";
import { requireUser } from "@/lib/auth";
import { listEventsWithTotals } from "@/lib/events";

export const dynamic = "force-dynamic";

export default async function IdeasPage() {
  const user = await requireUser();
  const { t, intl } = await getI18n();
  const ideas = (await listEventsWithTotals(user.id)).filter((e) => e.status === "idea");

  return (
    <>
      <PageHeader title={t.ideas.title} subtitle={t.ideas.subtitle} />
      <div className="space-y-4 px-4">
        <form action={createEvent} className="flex gap-2">
          <input type="hidden" name="status" value="idea" />
          <input type="hidden" name="type" value="trip" />
          <input name="title" required placeholder={t.ev.ideaPlaceholder} className={inputCls} />
          <button className={`${btnCls} shrink-0`} aria-label={t.ev.addIdea}>＋</button>
        </form>
        {ideas.length ? (
          <EventList events={ideas} t={t.ev} intl={intl} />
        ) : (
          <div className="rounded-2xl border border-dashed border-slate-300 p-6 text-center text-sm text-slate-500">{t.ideas.empty}</div>
        )}
      </div>
    </>
  );
}
