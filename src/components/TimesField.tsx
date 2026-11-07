"use client";

import { useState } from "react";
import { inputCls } from "@/components/ui";

/** Несколько времён "HH:MM" (name="time"), можно добавлять и убирать. */
export default function TimesField({ initial, addLabel }: { initial: string[]; addLabel: string }) {
  const [times, setTimes] = useState<string[]>(initial.length ? initial : ["08:00"]);
  return (
    <div className="space-y-2">
      <div className="grid grid-cols-2 gap-2">
        {times.map((t, i) => (
          <div key={i} className="flex items-center gap-1">
            <input
              type="time"
              name="time"
              value={t}
              required
              onChange={(e) => setTimes(times.map((x, j) => (j === i ? e.target.value : x)))}
              className={inputCls}
            />
            {times.length > 1 && (
              <button
                type="button"
                aria-label="✕"
                onClick={() => setTimes(times.filter((_, j) => j !== i))}
                className="shrink-0 p-1 text-slate-400 active:text-rose-600"
              >
                ✕
              </button>
            )}
          </div>
        ))}
      </div>
      {times.length < 8 && (
        <button type="button" onClick={() => setTimes([...times, "12:00"])} className="text-sm font-medium text-emerald-700">
          {addLabel}
        </button>
      )}
    </div>
  );
}
