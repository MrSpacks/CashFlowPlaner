import EventList, { type EventSummary } from "@/components/EventList";
import type { Dict } from "@/i18n/dictionaries";

/** Прошедшие события: свёрнуты, по нажатию раскрываются — приглушённые, чтобы было видно, что они позади. */
export default function PastEvents({ events, t, intl }: { events: EventSummary[]; t: Dict["ev"]; intl: string }) {
  if (events.length === 0) return null;
  return (
    <details className="group">
      <summary className="flex cursor-pointer list-none items-center justify-between rounded-2xl px-3 py-2.5 text-sm font-medium text-slate-500 ring-1 ring-slate-200 active:bg-slate-50 [&::-webkit-details-marker]:hidden">
        <span>
          🕘 {t.pastToggle} ({events.length})
        </span>
        <svg viewBox="0 0 24 24" className="h-4 w-4 transition group-open:rotate-180" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round">
          <path d="M6 9l6 6 6-6" />
        </svg>
      </summary>
      <div className="mt-2 opacity-55 grayscale-[40%]">
        <EventList events={events} t={t} intl={intl} />
      </div>
    </details>
  );
}

/** Событие уже позади: дата окончания (или дата показа) раньше сегодняшней. */
export function isPastEvent(e: EventSummary, today: string) {
  const date = e.displayDate ?? e.startDate;
  if (!date) return false;
  const end = e.recurrence === "none" && e.endDate ? e.endDate : date;
  return end < today;
}
