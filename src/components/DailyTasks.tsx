"use client";

import { useOptimistic, useTransition } from "react";
import { toggleDailyTask } from "@/app/actions";
import type { DailyTask } from "@/db/schema";

type Labels = { progress: string; minutes: string };

/** Задачи плана дня с галочками: отметка видна сразу, сохраняется на сервере в фоне. */
export default function DailyTasks({
  planId,
  tasks,
  done,
  labels,
}: {
  planId: string;
  tasks: DailyTask[];
  done: Record<string, boolean>;
  labels: Labels;
}) {
  const [, start] = useTransition();
  const [state, setOptimistic] = useOptimistic(done, (cur, patch: Record<string, boolean>) => ({ ...cur, ...patch }));
  const count = tasks.filter((t) => state[t.id]).length;
  const pct = tasks.length ? Math.round((count / tasks.length) * 100) : 0;

  const toggle = (id: string, value: boolean) =>
    start(async () => {
      setOptimistic({ [id]: value });
      await toggleDailyTask(planId, id, value);
    });

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-3">
        <div className="h-2 flex-1 overflow-hidden rounded-full bg-slate-200">
          <div className="h-full rounded-full bg-emerald-500 transition-[width]" style={{ width: `${pct}%` }} />
        </div>
        <span className="text-sm tabular-nums text-slate-500">
          {labels.progress.replace("{done}", String(count)).replace("{total}", String(tasks.length))}
        </span>
      </div>
      <ul className="space-y-2">
        {tasks.map((t) => {
          const checked = !!state[t.id];
          return (
            <li key={t.id}>
              <label
                className={`flex cursor-pointer items-start gap-3 rounded-2xl p-4 ring-1 ${
                  checked ? "bg-emerald-50 ring-emerald-200" : "bg-white ring-slate-200"
                }`}
              >
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={(e) => toggle(t.id, e.target.checked)}
                  className="mt-0.5 h-5 w-5 shrink-0 accent-emerald-600"
                />
                <span className="min-w-0 flex-1">
                  <span className={`block font-medium ${checked ? "text-slate-500 line-through" : "text-slate-900"}`}>{t.title}</span>
                  <span className="mt-1 flex flex-wrap items-center gap-2 text-xs text-slate-500">
                    {t.area && <span className="rounded-full bg-emerald-100 px-2 py-0.5 font-semibold text-emerald-700">{t.area}</span>}
                    {t.minutes ? <span>{labels.minutes.replace("{n}", String(t.minutes))}</span> : null}
                  </span>
                  {t.why && <span className="mt-1 block text-sm text-slate-500">{t.why}</span>}
                </span>
              </label>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
