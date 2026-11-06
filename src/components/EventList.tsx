import Link from "next/link";
import type { Dict } from "@/i18n/dictionaries";
import { timeText, TYPE_ICON, type EventRow } from "@/lib/events";
import { formatDate, formatMoney } from "@/lib/forecast";

export type EventSummary = EventRow & {
  total: number;
  unpaid: number;
  fullTotal?: number;
  shared?: boolean;
  people?: number;
  displayDate?: string | null;
  foreign?: boolean;
  authorName?: string | null;
};

export default function EventList({ events, t, intl }: { events: EventSummary[]; t: Dict["ev"]; intl: string }) {
  return (
    <ul className="divide-y divide-slate-100 overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-slate-200">
      {events.map((e) => {
        const date = e.displayDate ?? e.startDate;
        return (
          <li key={`${e.id}-${date ?? ""}`}>
            <Link href={`/events/${e.id}`} className="flex items-center gap-3 px-3 py-3 active:bg-slate-50">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-slate-50 text-xl">
                {TYPE_ICON[e.type]}
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium">{e.title}</p>
                <p className="truncate text-xs text-slate-500">
                  {date ? formatDate(date, intl) : t.noDate}
                  {e.startTime && ` · 🕒 ${timeText(e)}`} · {t.statuses[e.status]}
                  {(e.people ?? 0) > 1 && ` · 👥 ${e.people}`}
                  {e.recurrence !== "none" && " · ↻"}
                  {e.authorName && ` · 👤 ${e.authorName}`}
                </p>
              </div>
              {e.foreign && (e.fullTotal ?? 0) > 0 && (
                <p className="shrink-0 text-sm text-slate-400">{formatMoney(e.fullTotal!, e.currency, intl)}</p>
              )}
              {e.total > 0 && (
                <div className="shrink-0 text-right text-sm">
                  <p className="font-medium">{formatMoney(e.total, e.currency, intl)}</p>
                  {e.shared && e.fullTotal ? (
                    <p className="text-[11px] text-slate-400">
                      {t.ofTotal} {formatMoney(e.fullTotal, e.currency, intl)}
                    </p>
                  ) : null}
                  {e.unpaid > 0.5 && <p className="text-xs text-rose-600">−{formatMoney(e.unpaid, e.currency, intl)}</p>}
                </div>
              )}
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
