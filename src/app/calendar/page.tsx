import PageHeader from "@/components/PageHeader";
import { getI18n } from "@/i18n/server";
import { requireUser } from "@/lib/auth";
import { monthLabel, todayISO } from "@/lib/forecast";

export const dynamic = "force-dynamic";

export default async function CalendarPage() {
  await requireUser();
  const { t } = await getI18n();
  const today = todayISO();
  const [year, month, dayToday] = today.split("-").map(Number);
  const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const offset = (new Date(Date.UTC(year, month - 1, 1)).getUTCDay() + 6) % 7; // понедельник = 0
  const cells: (number | null)[] = [
    ...Array.from({ length: offset }, () => null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];

  return (
    <>
      <PageHeader title={t.calendar.title} subtitle={monthLabel(today.slice(0, 7), t.months)} />
      <div className="mx-4 rounded-2xl bg-white p-3 shadow-sm ring-1 ring-slate-200">
        <div className="grid grid-cols-7 text-center text-xs font-medium text-slate-400">
          {t.weekdays.map((d) => (
            <div key={d} className="py-1">{d}</div>
          ))}
        </div>
        <div className="grid grid-cols-7 gap-1 text-center text-sm">
          {cells.map((d, i) => (
            <div
              key={i}
              className={`flex aspect-square items-center justify-center rounded-lg ${
                d === dayToday ? "bg-emerald-600 font-semibold text-white" : d ? "text-slate-700" : ""
              }`}
            >
              {d ?? ""}
            </div>
          ))}
        </div>
      </div>
      <p className="mx-4 mt-6 text-center text-sm text-slate-500">{t.calendar.empty}</p>
    </>
  );
}
