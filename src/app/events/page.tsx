import Link from "next/link";
import EventList from "@/components/EventList";
import PageHeader from "@/components/PageHeader";
import { BackLink, btnCls } from "@/components/ui";
import { getI18n } from "@/i18n/server";
import { requireUser } from "@/lib/auth";
import { listEventsWithTotals, nextOccurrence } from "@/lib/events";
import { todayISO } from "@/lib/forecast";

export const dynamic = "force-dynamic";

export default async function EventsPage() {
  const user = await requireUser();
  const { t, intl } = await getI18n();
  const today = todayISO();

  const all = (await listEventsWithTotals(user.id)).filter((e) => e.status !== "idea");
  const withDate = all.map((e) => ({
    ...e,
    displayDate: e.startDate ? nextOccurrence(e.startDate, e.recurrence, today) : e.startDate,
  }));
  const upcoming = withDate
    .filter((e) => e.status !== "cancelled" && e.status !== "done" && ((e.endDate ?? e.displayDate ?? today) >= today || e.unpaid > 0))
    .sort((a, b) => (a.displayDate ?? "9999").localeCompare(b.displayDate ?? "9999"));
  const past = withDate.filter((e) => !upcoming.includes(e));

  return (
    <>
      <BackLink href="/calendar" label={t.calendar.title} />
      <PageHeader title={t.ev.allEvents} />
      <div className="space-y-5 px-4">
        <section>
          <h2 className="mb-2 text-sm font-medium text-slate-500">{t.ev.upcoming}</h2>
          {upcoming.length ? <EventList events={upcoming} t={t.ev} intl={intl} /> : <p className="text-sm text-slate-500">{t.ev.noEvents}</p>}
        </section>
        {past.length > 0 && (
          <section className="opacity-70">
            <EventList events={past} t={t.ev} intl={intl} />
          </section>
        )}
        <Link href="/events/new" className={`${btnCls} w-full`}>＋ {t.ev.newTitle}</Link>
      </div>
    </>
  );
}
