import PageHeader from "@/components/PageHeader";

const options = [
  { title: "Событие", text: "Поездка, день рождения, врач, покупка" },
  { title: "Трата", text: "Статья расхода внутри события" },
  { title: "Доход", text: "Зарплата или другое поступление за месяц" },
  { title: "Постоянный расход", text: "Аренда, коммуналка, подписки" },
];

export default function AddPage() {
  return (
    <>
      <PageHeader title="Добавить" />
      <ul className="space-y-2 px-4">
        {options.map((o) => (
          <li key={o.title} className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-200 opacity-70">
            <div className="flex items-center justify-between">
              <span className="font-medium">{o.title}</span>
              <span className="text-xs text-slate-400">скоро</span>
            </div>
            <p className="mt-0.5 text-sm text-slate-500">{o.text}</p>
          </li>
        ))}
      </ul>
    </>
  );
}
