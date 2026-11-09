import { markPersonalReminderDone } from "@/app/actions";
import type { Dict } from "@/i18n/dictionaries";
import { pendingReminders } from "@/lib/personalReminders";

/** Красные плашки невыполненных напоминаний — на любом экране, закреплены сверху, пока не нажали «Готово». */
export default async function PendingReminders({ userId, t }: { userId: string; t: Dict["prm"] }) {
  const pending = await pendingReminders(userId);
  if (pending.length === 0) return null;
  return (
    <div className="sticky top-0 z-30 space-y-2 px-4 pt-[max(0.75rem,env(safe-area-inset-top))] pb-2">
      {pending.map((p) => (
        <form
          key={`${p.reminderId}-${p.slot}`}
          action={markPersonalReminderDone}
          className="flex items-center justify-between gap-3 rounded-2xl bg-[#e11d48] p-4 text-[#fff] shadow-lg"
        >
          <input type="hidden" name="id" value={p.reminderId} />
          <input type="hidden" name="slot" value={p.slot} />
          <div className="min-w-0">
            <p className="truncate text-lg font-bold">⏰ {p.title}</p>
            <p className="text-sm text-[#ffe4e6]">
              {t.due} · {p.slot.slice(11)}
            </p>
          </div>
          <button className="shrink-0 rounded-xl bg-[#fff] px-4 py-2 font-semibold text-[#be123c]">{t.done}</button>
        </form>
      ))}
    </div>
  );
}
