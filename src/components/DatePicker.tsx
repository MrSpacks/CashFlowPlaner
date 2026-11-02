"use client";

import { useEffect, useRef, useState } from "react";

type Labels = { months: string[]; weekdays: string[]; today: string; clear: string; placeholder: string };

const pad = (n: number) => String(n).padStart(2, "0");
const iso = (y: number, m: number, d: number) => `${y}-${pad(m + 1)}-${pad(d)}`;
const todayIso = () => {
  const n = new Date();
  return iso(n.getFullYear(), n.getMonth(), n.getDate());
};

function usePopover() {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent | TouchEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const esc = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", close);
    document.addEventListener("touchstart", close);
    document.addEventListener("keydown", esc);
    return () => {
      document.removeEventListener("mousedown", close);
      document.removeEventListener("touchstart", close);
      document.removeEventListener("keydown", esc);
    };
  }, [open]);
  return { open, setOpen, ref };
}

const fieldCls =
  "flex w-full items-center justify-between gap-2 rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-left text-base text-slate-900 outline-none focus:border-emerald-500";
// Телефон: по центру экрана поверх затемнения (не вылезает за край). Шире — выпадает под полем.
const popCls =
  "fixed left-1/2 top-1/2 z-50 w-[19rem] -translate-x-1/2 -translate-y-1/2 rounded-2xl bg-white p-3 shadow-lg ring-1 ring-slate-200 sm:absolute sm:left-0 sm:top-full sm:mt-1 sm:translate-x-0 sm:translate-y-0";
const Backdrop = ({ onClose }: { onClose: () => void }) => (
  <div className="fixed inset-0 z-40 bg-black/30 sm:hidden" aria-hidden onClick={onClose} />
);

const CalIcon = () => (
  <svg viewBox="0 0 24 24" className="h-5 w-5 shrink-0 text-slate-400" fill="none" stroke="currentColor" strokeWidth={1.8}>
    <path d="M7 3v3m10-3v3M4 9h16M5 5h14a1 1 0 0 1 1 1v13a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1Z" />
  </svg>
);

/** Выбор даты: календарь с понедельника, месяцы и дни на языке приложения. Значение — YYYY-MM-DD в скрытом поле. */
export default function DatePicker({
  name,
  defaultValue = "",
  labels,
  required,
  allowClear = true,
}: {
  name: string;
  defaultValue?: string | null;
  labels: Labels;
  required?: boolean;
  allowClear?: boolean;
}) {
  const [value, setValue] = useState(defaultValue ?? "");
  const start = value || todayIso();
  const [view, setView] = useState({ y: Number(start.slice(0, 4)), m: Number(start.slice(5, 7)) - 1 });
  const { open, setOpen, ref } = usePopover();
  const today = todayIso();

  const days = new Date(view.y, view.m + 1, 0).getDate();
  const offset = (new Date(view.y, view.m, 1).getDay() + 6) % 7; // понедельник = 0
  const cells = [...Array(offset).fill(null), ...Array.from({ length: days }, (_, i) => i + 1)];
  const shift = (n: number) => setView(({ y, m }) => ({ y: m + n < 0 ? y - 1 : m + n > 11 ? y + 1 : y, m: (m + n + 12) % 12 }));

  const display = value
    ? `${Number(value.slice(8))} ${labels.months[Number(value.slice(5, 7)) - 1].toLowerCase()} ${value.slice(0, 4)}`
    : labels.placeholder;

  return (
    <div ref={ref} className="relative">
      <input type="hidden" name={name} value={value} />
      {/* невидимое поле, чтобы сработала проверка «обязательно» */}
      {required && <input tabIndex={-1} aria-hidden required value={value} onChange={() => {}} className="pointer-events-none absolute h-0 w-0 opacity-0" />}
      <button
        type="button"
        onClick={() => {
          const s = value || todayIso();
          setView({ y: Number(s.slice(0, 4)), m: Number(s.slice(5, 7)) - 1 });
          setOpen(!open);
        }}
        className={fieldCls}
      >
        <span className={value ? "" : "text-slate-400"}>{display}</span>
        <CalIcon />
      </button>

      {open && <Backdrop onClose={() => setOpen(false)} />}
      {open && (
        <div className={popCls}>
          <div className="mb-2 flex items-center justify-between">
            <button type="button" onClick={() => shift(-1)} className="rounded-lg p-1.5 text-slate-500 active:bg-slate-100" aria-label="‹">
              <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={2}><path d="M15 18l-6-6 6-6" /></svg>
            </button>
            <span className="text-sm font-semibold text-slate-900">
              {labels.months[view.m]} {view.y}
            </span>
            <button type="button" onClick={() => shift(1)} className="rounded-lg p-1.5 text-slate-500 active:bg-slate-100" aria-label="›">
              <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={2}><path d="M9 18l6-6-6-6" /></svg>
            </button>
          </div>
          <div className="grid grid-cols-7 text-center text-xs font-medium text-slate-400">
            {labels.weekdays.map((w, i) => (
              <div key={w} className={`py-1 ${i >= 5 ? "text-rose-600" : ""}`}>{w}</div>
            ))}
          </div>
          <div className="grid grid-cols-7 gap-0.5 text-center text-sm">
            {cells.map((d, i) => {
              if (!d) return <div key={i} />;
              const v = iso(view.y, view.m, d);
              const selected = v === value;
              const isToday = v === today;
              return (
                <button
                  type="button"
                  key={i}
                  onClick={() => {
                    setValue(v);
                    setOpen(false);
                  }}
                  className={`aspect-square rounded-lg ${
                    selected
                      ? "bg-emerald-600 font-semibold text-white"
                      : isToday
                        ? "font-semibold text-emerald-700 ring-1 ring-emerald-300"
                        : "text-slate-700 active:bg-slate-100"
                  }`}
                >
                  {d}
                </button>
              );
            })}
          </div>
          <div className="mt-2 flex justify-between text-sm">
            <button
              type="button"
              onClick={() => {
                setValue(today);
                setOpen(false);
              }}
              className="rounded-lg px-2 py-1 font-medium text-emerald-700 active:bg-emerald-50"
            >
              {labels.today}
            </button>
            {allowClear && !required && value && (
              <button
                type="button"
                onClick={() => {
                  setValue("");
                  setOpen(false);
                }}
                className="rounded-lg px-2 py-1 text-slate-500 active:bg-slate-100"
              >
                {labels.clear}
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

/** Выбор дня месяца (1–31) — для дня зарплаты и постоянных платежей. */
export function DayOfMonthPicker({
  name,
  defaultValue,
  labels,
}: {
  name: string;
  defaultValue?: number | null;
  labels: { placeholder: string; clear: string; dayFormat: string };
}) {
  const [value, setValue] = useState<number | null>(defaultValue ?? null);
  const { open, setOpen, ref } = usePopover();

  return (
    <div ref={ref} className="relative">
      <input type="hidden" name={name} value={value ?? ""} />
      <button type="button" onClick={() => setOpen(!open)} className={fieldCls}>
        <span className={value ? "" : "text-slate-400"}>{value ? labels.dayFormat.replace("{d}", String(value)) : labels.placeholder}</span>
        <CalIcon />
      </button>
      {open && <Backdrop onClose={() => setOpen(false)} />}
      {open && (
        <div className={popCls}>
          <div className="grid grid-cols-7 gap-0.5 text-center text-sm">
            {Array.from({ length: 31 }, (_, i) => i + 1).map((d) => (
              <button
                type="button"
                key={d}
                onClick={() => {
                  setValue(d);
                  setOpen(false);
                }}
                className={`aspect-square rounded-lg ${
                  value === d ? "bg-emerald-600 font-semibold text-white" : "text-slate-700 active:bg-slate-100"
                }`}
              >
                {d}
              </button>
            ))}
          </div>
          {value && (
            <div className="mt-2 text-right">
              <button
                type="button"
                onClick={() => {
                  setValue(null);
                  setOpen(false);
                }}
                className="rounded-lg px-2 py-1 text-sm text-slate-500 active:bg-slate-100"
              >
                {labels.clear}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
