import Link from "next/link";
import { notFound } from "next/navigation";
import {
  addExpenseItem,
  addParticipant,
  addSettlement,
  deleteEvent,
  deleteExpenseItem,
  deleteSettlement,
  removeParticipant,
  toggleExpensePaid,
} from "@/app/actions";
import DatePicker from "@/components/DatePicker";
import EventForm from "@/components/EventForm";
import QrCode from "@/components/QrCode";
import ShareLink from "@/components/ShareLink";
import { BackLink, Card, CurrencySelect, btnCls, btnGhostCls, inputCls, labelCls } from "@/components/ui";
import { dateLabels } from "@/i18n/dictionaries";
import { getI18n } from "@/i18n/server";
import { requireUser } from "@/lib/auth";
import { getEventAccess, getItemsWithPayments, TYPE_ICON } from "@/lib/events";
import { getProfile, getRates } from "@/lib/finance";
import { formatDate, formatMoney, todayISO } from "@/lib/forecast";
import { ensureCreatorParticipant, eventBalances, getSplitData, payerOf, transfers } from "@/lib/split";

export const dynamic = "force-dynamic";

const XIcon = () => (
  <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2}>
    <path d="M6 6l12 12M18 6L6 18" />
  </svg>
);

export default async function EventPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ notfound?: string }>;
}) {
  const user = await requireUser();
  const { id } = await params;
  const { notfound } = await searchParams;
  const access = await getEventAccess(id, user.id);
  if (!access) notFound();
  const { ev, canEdit } = access;
  if (ev.createdBy === user.id) await ensureCreatorParticipant(ev, user.name);

  const { t, intl } = await getI18n();
  const profile = await getProfile(user.id);
  const [{ items, pays }, { parts, shares, setts }] = await Promise.all([
    getItemsWithPayments([ev.id]),
    getSplitData([ev.id]),
  ]);
  const cur = ev.currency;
  const rates = [...items, ...setts].some((i) => i.currency !== cur) ? await getRates(cur) : {};
  const toEv = (a: number, c: string) => (c === cur || !rates[c] ? a : a / rates[c]);
  const money = (n: number, c = cur) => formatMoney(n, c, intl);
  const today = todayISO();

  const me = parts.find((p) => p.userId === user.id);
  const nameOf = (pid: string | null | undefined) => {
    const p = parts.find((x) => x.id === pid);
    if (!p) return "—";
    return p.userId === user.id ? `${p.displayName} (${t.pt.you})` : p.displayName;
  };
  const multi = parts.length > 1;

  let total = 0;
  let paid = 0;
  for (const it of items) {
    total += toEv(Number(it.amount), it.currency);
    if (it.status === "paid") paid += toEv(Number(it.amount), it.currency);
    else paid += pays.filter((p) => p.expenseItemId === it.id).reduce((a, p) => a + toEv(Number(p.amount), p.currency), 0);
  }

  const balances = eventBalances(ev, items, pays, parts, shares, setts, toEv);
  const trans = transfers(balances);

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
          {ev.recurrence !== "none" && ` · ↻ ${t.ev.repeatOpts[ev.recurrence]}`}
          {ev.visibility === "private" && " · 🔒"}
          {!canEdit && ` · 👁 ${t.sh.readOnly}`}
        </p>
        <h1 className="mt-1 text-2xl font-bold tracking-tight text-slate-900">{ev.title}</h1>
        <p className="mt-1 text-sm text-slate-500">{dateText}</p>
        {ev.notes && <p className="mt-2 whitespace-pre-line text-sm text-slate-600">{ev.notes}</p>}
      </header>

      <div className="space-y-4 px-4">
        {/* Итоги */}
        <div className="grid grid-cols-3 gap-2 text-center">
          {[
            [t.ev.total, total, "text-slate-900"],
            [t.ev.paid, paid, "text-emerald-700"],
            [t.ev.remaining, Math.max(total - paid, 0), "text-rose-600"],
          ].map(([label, value, cls]) => (
            <div key={label as string} className="rounded-2xl bg-white p-3 shadow-sm ring-1 ring-slate-200">
              <p className="text-xs text-slate-500">{label}</p>
              <p className={`truncate font-semibold ${cls}`}>{money(value as number)}</p>
            </div>
          ))}
        </div>

        <div className="space-y-4 lg:grid lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)] lg:items-start lg:gap-6 lg:space-y-0">
        <div className="space-y-4">
        {/* Траты */}
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
                const only = shares.filter((s) => s.expenseItemId === it.id);
                const sub = [
                  isPaid ? t.ev.paid : due ? `${formatDate(due, intl)}${overdue ? ` · ${t.ev.overdue}` : ""}` : t.ev.noDate,
                  multi ? t.pt.paidBy(nameOf(payerOf(it, ev, parts))) : null,
                  multi && only.length ? t.pt.onlyFor(only.map((s) => nameOf(s.participantId)).join(", ")) : null,
                ].filter(Boolean);
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
                    <Link
                      href={canEdit ? `/events/${ev.id}/items/${it.id}` : "#"}
                      aria-label={t.ev.editExpense}
                      className="flex min-w-0 flex-1 items-center gap-3 rounded-lg active:bg-slate-50"
                    >
                      <div className="min-w-0 flex-1">
                        <p className={`truncate font-medium ${isPaid ? "text-slate-400 line-through" : ""}`}>{it.title}</p>
                        <p className={`text-xs ${overdue ? "text-rose-600" : "text-slate-400"}`}>{sub.join(" · ")}</p>
                      </div>
                      <span className="shrink-0 text-right">
                        {it.isEstimate && !isPaid ? "~" : ""}
                        {money(Number(it.amount), it.currency)}
                      </span>
                      {canEdit && (
                        <svg viewBox="0 0 24 24" className="h-4 w-4 shrink-0 text-slate-300" fill="none" stroke="currentColor" strokeWidth={2}>
                          <path d="M4 20h4L19 9l-4-4L4 16v4zM14 6l4 4" />
                        </svg>
                      )}
                    </Link>
                    <form action={deleteExpenseItem}>
                      <input type="hidden" name="id" value={it.id} />
                      <button aria-label={t.common.delete} className="p-1 text-slate-300 active:text-rose-600">
                        <XIcon />
                      </button>
                    </form>
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        {/* Добавить трату */}
        {canEdit && (
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
              <DatePicker name="due" labels={dateLabels(t)} />
              <p className="mt-1 text-xs text-slate-400">{t.ev.dueHint}</p>
            </div>
            {multi && (
              <>
                <div>
                  <label className={labelCls}>{t.pt.payer}</label>
                  <select name="payer" defaultValue={me?.id} className={inputCls}>
                    {parts.map((p) => (
                      <option key={p.id} value={p.id}>{nameOf(p.id)}</option>
                    ))}
                  </select>
                </div>
                <fieldset>
                  <legend className={labelCls}>{t.pt.splitBetween}</legend>
                  <div className="flex flex-wrap gap-2">
                    {parts.map((p) => (
                      <label key={p.id} className="cursor-pointer">
                        <input type="checkbox" name="split" value={p.id} defaultChecked className="peer sr-only" />
                        <span className="inline-block rounded-full px-3 py-1 text-sm ring-1 ring-slate-300 peer-checked:bg-emerald-50 peer-checked:text-emerald-700 peer-checked:ring-emerald-400">
                          {nameOf(p.id)}
                        </span>
                      </label>
                    ))}
                  </div>
                </fieldset>
              </>
            )}
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" name="estimate" defaultChecked className="h-5 w-5 accent-emerald-600" />
              {t.ev.estimate}
            </label>
            <button className={`${btnCls} w-full`}>{t.common.add}</button>
          </form>
        </Card>
        )}

        </div>
        <div className="space-y-4">
        {/* Кто кому должен */}
        {multi && (
          <section>
            <h2 className="mb-2 text-sm font-medium text-slate-500">{t.pt.balances}</h2>
            <Card className="space-y-3">
              {trans.length === 0 ? (
                <p className="text-sm text-slate-600">{t.pt.allSettled}</p>
              ) : (
                <ul className="space-y-2">
                  {trans.map((tr) => (
                    <li key={`${tr.from}-${tr.to}`} className="flex items-center justify-between gap-2 text-sm">
                      <span className="min-w-0 truncate">
                        {t.pt.owesTo(nameOf(tr.from), nameOf(tr.to))}: <b>{money(tr.amount)}</b>
                      </span>
                      <form action={addSettlement}>
                        <input type="hidden" name="eventId" value={ev.id} />
                        <input type="hidden" name="from" value={tr.from} />
                        <input type="hidden" name="to" value={tr.to} />
                        <input type="hidden" name="amount" value={tr.amount} />
                        <button className="shrink-0 rounded-lg bg-emerald-600 px-2.5 py-1 text-xs font-medium text-white active:bg-emerald-700">
                          ✓ {t.pt.markReturned}
                        </button>
                      </form>
                    </li>
                  ))}
                </ul>
              )}

              <table className="w-full text-xs text-slate-500">
                <thead>
                  <tr>
                    <th className="py-1 text-left font-medium" />
                    <th className="py-1 text-right font-medium">{t.pt.paidSoFar}</th>
                    <th className="py-1 text-right font-medium">{t.pt.shareOfBudget}</th>
                  </tr>
                </thead>
                <tbody>
                  {balances.map((b) => (
                    <tr key={b.participantId} className="border-t border-slate-100">
                      <td className="max-w-0 truncate py-1.5 text-slate-700">{nameOf(b.participantId)}</td>
                      <td className="py-1.5 text-right">{money(b.paid)}</td>
                      <td className="py-1.5 text-right">{money(b.shareTotal)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {setts.length > 0 && (
                <div>
                  <p className="mb-1 text-xs font-medium text-slate-500">{t.pt.returns}</p>
                  <ul className="space-y-1 text-xs text-slate-600">
                    {setts.map((s) => (
                      <li key={s.id} className="flex items-center justify-between gap-2">
                        <span className="min-w-0 truncate">
                          {s.settledAt ? `${formatDate(s.settledAt, intl)} · ` : ""}
                          {t.pt.owesTo(nameOf(s.fromParticipantId), nameOf(s.toParticipantId))}: {money(Number(s.amount), s.currency)}
                        </span>
                        <form action={deleteSettlement}>
                          <input type="hidden" name="id" value={s.id} />
                          <button aria-label={t.common.delete} className="p-1 text-slate-300 active:text-rose-600">
                            <XIcon />
                          </button>
                        </form>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </Card>
          </section>
        )}

        {/* Участники */}
        <Card>
          <h2 className="mb-1 font-semibold">{t.pt.title}</h2>
          <p className="mb-3 text-xs text-slate-500">{t.pt.inviteHint}</p>
          {notfound && <p className="mb-3 rounded-xl bg-amber-50 px-3 py-2 text-xs text-amber-800">{t.pt.notFoundEmail}</p>}
          <ul className="mb-3 divide-y divide-slate-100 text-sm">
            {parts.map((p) => (
              <li key={p.id} className="py-2">
                <div className="flex items-center justify-between gap-2">
                <div className="min-w-0">
                  <p className="truncate font-medium">{nameOf(p.id)}</p>
                  <p className="text-xs text-slate-400">{p.userId ? t.pt.joined : t.pt.guest}</p>
                </div>
                <div className="flex shrink-0 items-center gap-1">
                  {!p.userId && p.inviteToken && (
                    <ShareLink path={`/invite/${p.inviteToken}`} label={t.pt.invite} copiedLabel={t.pt.copied} title={ev.title} />
                  )}
                  {p.userId !== ev.createdBy && (
                    <form action={removeParticipant}>
                      <input type="hidden" name="id" value={p.id} />
                      <button aria-label={t.pt.remove} className="p-1 text-slate-300 active:text-rose-600">
                        <XIcon />
                      </button>
                    </form>
                  )}
                </div>
                </div>
                {!p.userId && p.inviteToken && (
                  <div className="mt-2">
                    <QrCode path={`/invite/${p.inviteToken}`} label={t.sh.qr} hint={t.sh.qrHint} />
                  </div>
                )}
              </li>
            ))}
          </ul>
          {canEdit && (
          <form action={addParticipant} className="flex gap-2">
            <input type="hidden" name="eventId" value={ev.id} />
            <input name="name" required placeholder={t.pt.namePlaceholder} className={inputCls} />
            <button className={`${btnCls} shrink-0`} aria-label={t.common.add}>＋</button>
          </form>
          )}
        </Card>

        {/* Редактирование и удаление */}
        {canEdit && (
        <details className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-200">
          <summary className="cursor-pointer font-semibold">{t.ev.edit}</summary>
          <div className="mt-3">
            <EventForm t={t.ev} event={ev} baseCurrency={profile.baseCurrency} privateLabel={t.sh.privateEvent} dates={dateLabels(t)} />
          </div>
        </details>
        )}

        {ev.createdBy === user.id && (
          <details className="rounded-2xl p-1">
            <summary className="cursor-pointer px-3 py-2 text-sm text-rose-600">{t.ev.deleteEvent}</summary>
            <form action={deleteEvent} className="mt-2 space-y-2 px-3">
              <input type="hidden" name="id" value={ev.id} />
              <p className="text-xs text-slate-500">{t.ev.deleteHint}</p>
              <button className={`${btnGhostCls} w-full text-rose-600`}>{t.ev.deleteEvent}</button>
            </form>
          </details>
        )}
        </div>
        </div>
      </div>
    </>
  );
}
