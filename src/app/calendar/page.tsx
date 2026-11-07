import Link from "next/link";
import EventList, { type EventSummary } from "@/components/EventList";
import PageHeader from "@/components/PageHeader";
import { btnCls, cardCls } from "@/components/ui";
import { getI18n } from "@/i18n/server";
import { requireUser } from "@/lib/auth";
import { byDateTime, listEventsWithTotals, occurrenceInMonth, TYPE_DOT } from "@/lib/events";
import { addMonths, daysInMonth, monthLabel, todayISO } from "@/lib/forecast";

export const dynamic = "force-dynamic";

const Arrow = ({ d }: { d: string }) => (
  <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={2}>
    <path d={d} />
  </svg>
);

export default async function CalendarPage({ searchParams }: { searchParams: Promise<{ m?: string; d?: string }> }) {
  const user = await requireUser();
  const { t, intl } = await getI18n();
  const today = todayISO();
  const { m, d: dayParam } = await searchParams;
  const month = m && /^\d{4}-\d{2}$/.test(m) ? m : today.slice(0, 7);
  const [year, mon] = month.split("-").map(Number);
  const first = `${month}-01`;
  const last = `${month}-${String(daysInMonth(month)).padStart(2, "0")}`;

  const all = (await listEventsWithTotals(user.id)).filter((e) => e.status !== "idea" && e.status !== "cancelled");

  // События, попадающие в месяц (с учётом ежегодных — дни рождения).
  const inMonth: EventSummary[] = [];
  for (const e of all) {
    if (!e.startDate) continue;
    if (e.recurrence !== "none") {
      const d = occurrenceInMonth(e.startDate, e.recurrence, month);
      if (d) inMonth.push({ ...e, displayDate: d });
    } else if (e.startDate <= last && (e.endDate ?? e.startDate) >= first) {
      inMonth.push({ ...e, displayDate: e.startDate < first ? first : e.startDate });
    }
  }
  inMonth.sort(byDateTime);

  // Точки по дням.
  const dots = new Map<number, string[]>();
  const byDay = new Map<number, string[]>(); // день → id событий
  for (const e of inMonth) {
    const s = e.recurrence !== "none" ? e.displayDate! : e.startDate!;
    const end = e.recurrence !== "none" ? s : e.endDate ?? s;
    for (let d = 1; d <= daysInMonth(month); d++) {
      const iso = `${month}-${String(d).padStart(2, "0")}`;
      if (iso >= s && iso <= end) {
        dots.set(d, [...(dots.get(d) ?? []), TYPE_DOT[e.type]]);
        byDay.set(d, [...(byDay.get(d) ?? []), e.id]);
      }
    }
  }

  const offset = (new Date(Date.UTC(year, mon - 1, 1)).getUTCDay() + 6) % 7;
  // Всегда 6 недель (42 клетки) — высота календаря не прыгает между месяцами.
  const prevMonth = addMonths(month, -1);
  const prevDays = daysInMonth(prevMonth);
  const cells: (number | null)[] = [
    ...Array.from({ length: offset }, () => null),
    ...Array.from({ length: daysInMonth(month) }, (_, i) => i + 1),
  ];
  while (cells.length < 42) cells.push(null);
  // число соседнего месяца для пустой клетки (серым)
  const ghost = (i: number) => (i < offset ? prevDays - offset + 1 + i : i - offset - daysInMonth(month) + 1);
  const isThisMonth = month === today.slice(0, 7);
  const selDay = dayParam && dayParam.startsWith(month) ? Number(dayParam.slice(8)) : null;
  const dayIso = (d: number) => `${month}-${String(d).padStart(2, "0")}`;
  // Нажатие на день: одно событие — сразу открыть, несколько — показать их под календарём, пусто — создать.
  const dayHref = (d: number) => {
    const ids = byDay.get(d) ?? [];
    if (ids.length === 1) return `/events/${ids[0]}`;
    if (ids.length > 1) return `/calendar?m=${month}&d=${dayIso(d)}`;
    return `/events/new?start=${dayIso(d)}`;
  };
  const listed = selDay ? inMonth.filter((e) => (byDay.get(selDay) ?? []).includes(e.id)) : inMonth;
  const todayDay = Number(today.slice(8));

  return (
    <>
      <PageHeader title={t.calendar.title} />
      <div className="lg:grid lg:grid-cols-2 lg:items-start lg:gap-2">
      <div className={`${cardCls} mx-4 p-3`}>
        <div className="mb-2 flex items-center justify-between">
          <Link href={`/calendar?m=${addMonths(month, -1)}`} className="rounded-lg p-1.5 text-slate-500 active:bg-slate-100" aria-label="prev">
            <Arrow d="M15 18l-6-6 6-6" />
          </Link>
          <Link href="/calendar" className="font-semibold">{monthLabel(month, t.months)}</Link>
          <Link href={`/calendar?m=${addMonths(month, 1)}`} className="rounded-lg p-1.5 text-slate-500 active:bg-slate-100" aria-label="next">
            <Arrow d="M9 18l6-6-6-6" />
          </Link>
        </div>
        <div className="grid grid-cols-7 text-center text-xs font-medium text-slate-400">
          {t.weekdays.map((d) => (
            <div key={d} className="py-1">{d}</div>
          ))}
        </div>
        <div className="grid grid-cols-7 gap-1 text-center text-sm">
          {cells.map((d, i) =>
            d ? (
              <Link
                key={i}
                href={dayHref(d)}
                className={`flex aspect-square flex-col items-center justify-center rounded-lg ${
                  isThisMonth && d === todayDay
                    ? "bg-emerald-600 font-semibold text-white"
                    : d === selDay
                      ? "bg-emerald-50 font-semibold text-emerald-700 ring-1 ring-emerald-300"
                      : (byDay.get(d)?.length ?? 0) > 0
                        ? "font-semibold text-slate-900 active:bg-slate-100"
                        : "text-slate-700 active:bg-slate-100"
                }`}
              >
                {d}
                <span className="mt-0.5 flex h-1.5 gap-0.5">
                  {(dots.get(d) ?? []).slice(0, 3).map((c, j) => (
                    <span key={j} className={`h-1.5 w-1.5 rounded-full ${c}`} />
                  ))}
                </span>
              </Link>
            ) : (
              <Link
                key={i}
                href={`/calendar?m=${addMonths(month, i < offset ? -1 : 1)}`}
                className="flex aspect-square flex-col items-center justify-center rounded-lg text-slate-300"
              >
                {ghost(i)}
                <span className="mt-0.5 h-1.5" />
              </Link>
            ),
          )}
        </div>
      </div>

      <div className="mt-5 px-4 lg:mt-0">
        <div className="mb-2 flex items-center justify-between">
          <h2 className="text-sm font-medium text-slate-500">
            {selDay ? `${t.ev.onDay}: ${selDay}. ${t.months[mon - 1].toLowerCase()}` : t.ev.inMonth}
            {selDay && (
              <Link href={`/calendar?m=${month}`} className="ml-2 text-emerald-700">
                ✕ {t.ev.showAll}
              </Link>
            )}
          </h2>
          <span className="flex gap-3">
            <Link href="/ideas" className="text-sm text-emerald-700">💡 {t.ideas.title}</Link>
            <Link href="/events" className="text-sm text-emerald-700">{t.ev.allEvents}</Link>
          </span>
        </div>
        {listed.length ? (
          <EventList events={listed} t={t.ev} intl={intl} />
        ) : (
          <p className="text-center text-sm text-slate-500">{t.calendar.empty}</p>
        )}
        <Link
          href={selDay ? `/events/new?start=${dayIso(selDay)}` : `/events/new${isThisMonth ? "" : `?start=${first}`}`}
          className={`${btnCls} mt-4 w-full`}
        >
          ＋ {selDay ? t.ev.newOnDay : t.ev.newTitle}
        </Link>
      </div>
      </div>
    </>
  );
}
