import { notFound } from "next/navigation";
import { addExpenseItem, deleteEvent, deleteExpenseItem, toggleExpensePaid } from "@/app/actions";
import EventForm from "@/components/EventForm";
import { BackLink, Card, CurrencySelect, btnCls, btnGhostCls, inputCls, labelCls } from "@/components/ui";
import { getI18n } from "@/i18n/server";
import { requireUser } from "@/lib/auth";
import { getItemsWithPayments, getEventForUser, TYPE_ICON } from "@/lib/events";
import { getProfile, getRates } from "@/lib/finance";
import { formatDate, formatMoney, todayISO } from "@/lib/forecast";

export const dynamic = "force-dynamic";

export default async function EventPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  const { id } = await params;
  const ev = await getEventForUser(id, user.id);
  if (!ev) notFound();

  const { t, intl } = await getI18n();
  const profile = await getProfile(user.id);
  const { items, pays } = await getItemsWithPayments([ev.id]);
  const cur = ev.currency;
  const rates = items.some((i) => i.currency !== cur) ? await getRates(cur) : {};
  const toEv = (a: number, c: string) => (c === cur || !rates[c] ? a : a / rates[c]);
  const today = todayISO();

  let total = 0;
  let paid = 0;
  for (const it of items) {
    total += toEv(Number(it.amount), it.currency);
    if (it.status === "paid") paid += toEv(Number(it.amount), it.currency);
    else paid += pays.filter((p) => p.expenseItemId === it.id).reduce((a, p) => a + toEv(Number(p.amount), p.currency), 0);
  }

  const dateText = ev.startDate
    ? ev.endDate && ev.endDate !== ev.startDate
      ? `${formatDate(ev.startDate, intl)} – ${formatDate(ev.endDate, intl)}`
      : formatDate(ev.startDate, intl)
    : t.ev.noDate;

  return (
    <>
      <BackLink href={ev.status === "idea" ? "/ideas" : "/calendar"} label={ev.status === "idea" ? t.ideas.title : t.calendar.title} />
      <header className="px-4 pt-4 pb-3">
        <p className="text-sm text-slate-500">
          {TYPE_ICON[ev.type]} {t.ev.types[ev.type]} · {t.ev.statuses[ev.status]}
          {ev.priority !== "want" && ` · ${t.ev.priorities[ev.priority]}`}
          {ev.recurrence === "yearly" && " · ↻"}
        </p>
        <h1 className="mt-1 text-2xl font-bold tracking-tight text-slate-900">{ev.title}</h1>
        <p className="mt-1 text-sm text-slate-500">{dateText}</p>
        {ev.notes && <p className="mt-2 whitespace-pre-line text-sm text-slate-600">{ev.notes}</p>}
      </header>

      <div className="space-y-4 px-4">
        <div className="grid grid-cols-3 gap-2 text-center">
          {[
            [t.ev.total, total, "text-slate-900"],
            [t.ev.paid, paid, "text-emerald-700"],
            [t.ev.remaining, Math.max(total - paid, 0), "text-rose-600"],
          ].map(([label, value, cls]) => (
            <div key={label as string} className="rounded-2xl bg-white p-3 shadow-sm ring-1 ring-slate-200">
              <p className="text-xs text-slate-500">{label}</p>
              <p className={`truncate font-semibold ${cls}`}>{formatMoney(value as number, cur, intl)}</p>
            </div>
          ))}
        </div>

        <section>
          <h2 className="mb-2 text-sm font-medium text-slate-500">{t.ev.expenses}</h2>
          {items.length === 0 ? (
            <p className="text-sm text-slate-500">{t.ev.noExpenses}</p>
          ) : (
            <ul className="divide-y divide-slate-100 overflow-hidden rounded-2xl bg-white text-sm shadow-sm ring-1 ring-slate-200">
              {items.map((it) => {
                const isPaid = it.status === "paid";
                const due = it.dueDate ?? ev.startDate;
                const overdue = !isPaid && due && due < today;
                return (
                  <li key={it.id} className="flex items-center gap-3 px-3 py-2.5">
                    <form action={toggleExpensePaid}>
                      <input type="hidden" name="id" value={it.id} />
                      <button
                        aria-label={isPaid ? t.ev.markUnpaid : t.ev.markPaid}
                        className={`flex h-6 w-6 items-center justify-center rounded-full ring-2 ${
                          isPaid ? "bg-emerald-600 text-white ring-emerald-600" : "ring-slate-300"
                        }`}
                      >
                        {isPaid && (
                          <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={3}>
                            <path d="M5 12l5 5L20 7" />
                          </svg>
                        )}
                      </button>
                    </form>
                    <div className="min-w-0 flex-1">
                      <p className={`truncate font-medium ${isPaid ? "text-slate-400 line-through" : ""}`}>{it.title}</p>
                      <p className={`text-xs ${overdue ? "text-rose-600" : "text-slate-400"}`}>
                        {isPaid ? t.ev.paid : due ? `${formatDate(due, intl)}${overdue ? ` · ${t.ev.overdue}` : ""}` : t.ev.noDate}
                      </p>
                    </div>
                    <span className="shrink-0 text-right">
                      {it.isEstimate && !isPaid ? "~" : ""}
                      {formatMoney(Number(it.amount), it.currency, intl)}
                    </span>
                    <form action={deleteExpenseItem}>
                      <input type="hidden" name="id" value={it.id} />
                      <button aria-label={t.common.delete} className="p-1 text-slate-300 active:text-rose-600">
                        <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2}>
                          <path d="M6 6l12 12M18 6L6 18" />
                        </svg>
                      </button>
                    </form>
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        <Card>
          <h2 className="mb-3 font-semibold">{t.ev.addExpense}</h2>
          <form action={addExpenseItem} className="space-y-3">
            <input type="hidden" name="eventId" value={ev.id} />
            <div>
              <label className={labelCls}>{t.ev.expenseName}</label>
              <input name="title" required placeholder={t.ev.expensePlaceholder} className={inputCls} />
            </div>
            <div className="grid grid-cols-[1fr_96px] gap-2">
              <div>
                <label className={labelCls}>{t.common.amount}</label>
                <input name="amount" inputMode="decimal" required className={inputCls} />
              </div>
              <div>
                <label className={labelCls}>{t.common.currency}</label>
                <CurrencySelect defaultValue={cur} />
              </div>
            </div>
            <div>
              <label className={labelCls}>{t.ev.dueDate}</label>
              <input name="due" type="date" className={inputCls} />
              <p className="mt-1 text-xs text-slate-400">{t.ev.dueHint}</p>
            </div>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" name="estimate" defaultChecked className="h-5 w-5 accent-emerald-600" />
              {t.ev.estimate}
            </label>
            <button className={`${btnCls} w-full`}>{t.common.add}</button>
          </form>
        </Card>

        <details className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-200">
          <summary className="cursor-pointer font-semibold">{t.ev.edit}</summary>
          <div className="mt-3">
            <EventForm t={t.ev} event={ev} baseCurrency={profile.baseCurrency} />
          </div>
        </details>

        <details className="rounded-2xl p-1">
          <summary className="cursor-pointer px-3 py-2 text-sm text-rose-600">{t.ev.deleteEvent}</summary>
          <form action={deleteEvent} className="mt-2 space-y-2 px-3">
            <input type="hidden" name="id" value={ev.id} />
            <p className="text-xs text-slate-500">{t.ev.deleteHint}</p>
            <button className={`${btnGhostCls} w-full text-rose-600`}>{t.ev.deleteEvent}</button>
          </form>
        </details>
      </div>
    </>
  );
}
