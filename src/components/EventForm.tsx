import { createEvent, updateEvent } from "@/app/actions";
import { CurrencySelect, btnCls, inputCls, labelCls } from "@/components/ui";
import { EventDateTimeFields } from "@/components/DatePicker";
import OfflineForm from "@/components/OfflineForm";
import type { Dict } from "@/i18n/dictionaries";
import { EVENT_PRIORITIES, EVENT_STATUSES, EVENT_TYPES, TYPE_ICON, type EventRow } from "@/lib/events";

export default function EventForm({
  t,
  event,
  defaults,
  baseCurrency,
  privateLabel,
  dates,
  savedOffline,
}: {
  t: Dict["ev"];
  privateLabel: string;
  dates: { months: string[]; weekdays: string[]; today: string; clear: string; placeholder: string };
  /** Текст «сохранено на телефоне» — включает офлайн-режим для новой формы. */
  savedOffline?: string;
  event?: EventRow;
  defaults?: { status?: string; start?: string; type?: string };
  baseCurrency: string;
}) {
  return (
    <FormShell event={!!event} savedOffline={savedOffline}>
      {event && <input type="hidden" name="id" value={event.id} />}
      <div>
        <label className={labelCls}>{t.name}</label>
        <input name="title" required defaultValue={event?.title} placeholder={t.namePlaceholder} className={inputCls} />
      </div>

      <div>
        <label className={labelCls}>{t.type}</label>
        <div className="grid grid-cols-5 gap-1.5">
          {EVENT_TYPES.map((ty) => (
            <label key={ty} className="cursor-pointer">
              <input
                type="radio"
                name="type"
                value={ty}
                defaultChecked={(event?.type ?? defaults?.type ?? "trip") === ty}
                className="peer sr-only"
              />
              <span className="flex flex-col items-center gap-0.5 rounded-xl px-1 py-2 text-[11px] text-slate-600 ring-1 ring-slate-200 peer-checked:bg-emerald-50 peer-checked:font-semibold peer-checked:text-emerald-700 peer-checked:ring-emerald-400">
                <span className="text-lg leading-none">{TYPE_ICON[ty]}</span>
                <span className="max-w-full truncate">{t.types[ty]}</span>
              </span>
            </label>
          ))}
        </div>
      </div>

      <EventDateTimeFields
        start={event?.startDate ?? defaults?.start ?? ""}
        end={event?.endDate}
        startTime={event?.startTime}
        endTime={event?.endTime}
        labels={{
          dates,
          start: t.start,
          end: t.end,
          withTime: t.withTime,
          from: t.timeFrom,
          to: t.timeTo,
          pickTime: t.pickTime,
          hours: t.hours,
          minutes: t.minutes,
        }}
      />

      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className={labelCls}>{t.status}</label>
          <select name="status" defaultValue={event?.status ?? defaults?.status ?? "planned"} className={inputCls}>
            {EVENT_STATUSES.map((s) => (
              <option key={s} value={s}>{t.statuses[s]}</option>
            ))}
          </select>
        </div>
        <div>
          <label className={labelCls}>{t.priority}</label>
          <select name="priority" defaultValue={event?.priority ?? "want"} className={inputCls}>
            {EVENT_PRIORITIES.map((p) => (
              <option key={p} value={p}>{t.priorities[p]}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="grid grid-cols-[1fr_110px] gap-2">
        <div>
          <label className={labelCls}>{t.repeat}</label>
          <select name="recurrence" defaultValue={event?.recurrence ?? "none"} className={inputCls}>
            {(["none", "monthly", "yearly"] as const).map((r) => (
              <option key={r} value={r}>{t.repeatOpts[r]}</option>
            ))}
          </select>
        </div>
        <div>
          <label className={labelCls}>{t.expenses}</label>
          <CurrencySelect defaultValue={event?.currency ?? baseCurrency} />
        </div>
      </div>

      {!event && (
        <div>
          <label className={labelCls}>{t.amount}</label>
          <input name="amount" inputMode="decimal" className={inputCls} />
          <p className="mt-1 text-xs text-slate-400">{t.amountHint}</p>
        </div>
      )}

      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" name="private" defaultChecked={event?.visibility === "private"} className="h-5 w-5 accent-emerald-600" />
        🔒 {privateLabel}
      </label>

      <div>
        <label className={labelCls}>{t.notes}</label>
        <textarea name="notes" rows={2} defaultValue={event?.notes ?? ""} className={inputCls} />
      </div>

      <button className={`${btnCls} w-full`}>{event ? t.edit : t.create}</button>
    </FormShell>
  );
}

function FormShell({ event, savedOffline, children }: { event: boolean; savedOffline?: string; children: React.ReactNode }) {
  if (!event && savedOffline) {
    return (
      <OfflineForm action={createEvent} className="space-y-3" savedText={savedOffline}>
        {children}
      </OfflineForm>
    );
  }
  return (
    <form action={event ? updateEvent : createEvent} className="space-y-3">
      {children}
    </form>
  );
}
