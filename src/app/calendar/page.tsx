import PageHeader from "@/components/PageHeader";
import { monthKey, monthLabel } from "@/lib/forecast";

export const dynamic = "force-dynamic";

const WEEKDAYS = ["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"];

export default function CalendarPage() {
  const today = new Date();
  const year = today.getFullYear();
  const month = today.getMonth();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const offset = (new Date(year, month, 1).getDay() + 6) % 7; // понедельник = 0
  const cells: (number | null)[] = [
    ...Array.from({ length: offset }, () => null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];

  return (
    <>
      <PageHeader title="Календарь" subtitle={monthLabel(monthKey(today))} />
      <div className="mx-4 rounded-2xl bg-white p-3 shadow-sm ring-1 ring-slate-200">
        <div className="grid grid-cols-7 text-center text-xs font-medium text-slate-400">
          {WEEKDAYS.map((d) => (
            <div key={d} className="py-1">{d}</div>
          ))}
        </div>
        <div className="grid grid-cols-7 gap-1 text-center text-sm">
          {cells.map((d, i) => (
            <div
              key={i}
              className={`flex aspect-square items-center justify-center rounded-lg ${
                d === today.getDate() ? "bg-emerald-600 font-semibold text-white" : d ? "text-slate-700" : ""
              }`}
            >
              {d ?? ""}
            </div>
          ))}
        </div>
      </div>
      <p className="mx-4 mt-6 text-center text-sm text-slate-500">Событий пока нет. Нажмите «＋», чтобы добавить.</p>
    </>
  );
}
