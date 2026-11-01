import PageHeader from "@/components/PageHeader";
import { addMonths, buildForecast, formatMoney, monthKey, monthLabel } from "@/lib/forecast";

export const dynamic = "force-dynamic";

// Демо-данные, пока нет входа и ввода своих данных.
function demo() {
  const start = monthKey(new Date());
  const m = (n: number) => addMonths(start, n);
  return buildForecast({
    startBalance: 18000,
    startMonth: start,
    months: 6,
    cushion: 5000,
    fixedMonthly: 24000,
    incomes: [
      { month: m(0), amount: 41000, actual: true },
      { month: m(1), amount: 38000, actual: false },
      { month: m(2), amount: 43000, actual: false },
      { month: m(3), amount: 40000, actual: false },
      { month: m(4), amount: 42000, actual: false },
    ],
    payments: [
      { month: m(0), amount: 2500, title: "Зубной", movable: false },
      { month: m(1), amount: 1500, title: "Подарок Пете", movable: false },
      { month: m(1), amount: 14000, title: "Билеты в Италию", movable: true },
      { month: m(2), amount: 22000, title: "Жильё в Италии (моя доля)", movable: false },
      { month: m(2), amount: 6000, title: "Новый телефон", movable: true },
      { month: m(3), amount: 9000, title: "Еда и транспорт в поездке", movable: false },
    ],
    refunds: [{ month: m(3), amount: 7000 }],
  });
}

const stateStyle = {
  ok: { ring: "ring-emerald-200", badge: "bg-emerald-100 text-emerald-700", label: "В плюсе" },
  tight: { ring: "ring-amber-200", badge: "bg-amber-100 text-amber-700", label: "Впритык" },
  negative: { ring: "ring-rose-300", badge: "bg-rose-100 text-rose-700", label: "Не хватает" },
} as const;

export default function ForecastPage() {
  const months = demo();

  return (
    <>
      <PageHeader title="Прогноз" subtitle="Сколько придёт, сколько уйдёт и что останется" />
      <div className="mx-4 mb-4 rounded-xl bg-sky-50 px-3 py-2 text-xs text-sky-800">
        Сейчас показаны демо-данные. После входа здесь будут ваши доходы и события.
      </div>

      <ul className="space-y-3 px-4">
        {months.map((mo) => {
          const s = stateStyle[mo.state];
          return (
            <li key={mo.month} className={`rounded-2xl bg-white p-4 shadow-sm ring-1 ${s.ring}`}>
              <div className="flex items-center justify-between">
                <h2 className="font-semibold">{monthLabel(mo.month)}</h2>
                <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${s.badge}`}>{s.label}</span>
              </div>

              <dl className="mt-3 grid grid-cols-3 gap-2 text-sm">
                <div>
                  <dt className="text-slate-500">Придёт</dt>
                  <dd className="font-medium text-emerald-700">
                    {mo.incomeMissing ? <span className="text-amber-600">не указано</span> : formatMoney(mo.income + mo.refunds)}
                  </dd>
                </div>
                <div>
                  <dt className="text-slate-500">Уйдёт</dt>
                  <dd className="font-medium text-slate-800">{formatMoney(mo.fixed + mo.eventPayments)}</dd>
                </div>
                <div className="text-right">
                  <dt className="text-slate-500">Итог</dt>
                  <dd className={`font-bold ${mo.closing < 0 ? "text-rose-600" : "text-slate-900"}`}>
                    {formatMoney(mo.closing)}
                  </dd>
                </div>
              </dl>

              {mo.movable.length > 0 && (
                <p className="mt-3 rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-600">
                  Можно перенести: {mo.movable.map((x) => `${x.title} (${formatMoney(x.amount)})`).join(", ")}
                </p>
              )}
            </li>
          );
        })}
      </ul>
    </>
  );
}
