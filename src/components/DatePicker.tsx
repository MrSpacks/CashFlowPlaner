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
  value: controlled,
  onChange,
  min,
}: {
  name: string;
  defaultValue?: string | null;
  labels: Labels;
  required?: boolean;
  allowClear?: boolean;
  /** Управляемый режим (для связанных полей «от — до»). */
  value?: string;
  onChange?: (v: string) => void;
  /** Раньше этой даты выбрать нельзя. */
  min?: string | null;
}) {
  const [inner, setInner] = useState(defaultValue ?? "");
  const value = controlled ?? inner;
  const setValue = (v: string) => {
    if (controlled === undefined) setInner(v);
    onChange?.(v);
  };
  const start = value || min || todayIso();
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
          const s = value || min || todayIso();
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
              const disabled = !!min && v < min;
              const inRange = !!min && !!value && v > min && v < value;
              const isMin = !!min && v === min;
              return (
                <button
                  type="button"
                  key={i}
                  disabled={disabled}
                  onClick={() => {
                    setValue(v);
                    setOpen(false);
                  }}
                  className={`aspect-square rounded-lg ${
                    selected
                      ? "bg-emerald-600 font-semibold text-white"
                      : disabled
                        ? "cursor-not-allowed text-slate-300"
                        : isMin
                          ? "font-semibold text-emerald-700 ring-1 ring-emerald-400"
                          : inRange
                            ? "bg-emerald-50 text-emerald-700"
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
            {!(min && today < min) ? (
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
            ) : (
              <span />
            )}
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

const ClockIcon = () => (
  <svg viewBox="0 0 24 24" className="h-5 w-5 shrink-0 text-slate-400" fill="none" stroke="currentColor" strokeWidth={1.8}>
    <circle cx="12" cy="12" r="9" />
    <path d="M12 7v5l3 2" />
  </svg>
);

/** Выбор времени 24 ч: сетка часов и минут с шагом 5. Значение «HH:MM» в скрытом поле. */
export function TimePicker({
  name,
  defaultValue,
  labels,
  value: controlled,
  onChange,
  min,
}: {
  name: string;
  defaultValue?: string | null;
  labels: { placeholder: string; hours: string; minutes: string; clear: string };
  value?: string;
  onChange?: (v: string) => void;
  /** Нельзя выбрать время раньше этого или равное ему («HH:MM»). */
  min?: string | null;
}) {
  const [inner, setInner] = useState(defaultValue ?? "");
  const value = controlled ?? inner;
  const setValue = (v: string) => {
    if (controlled === undefined) setInner(v);
    onChange?.(v);
  };
  const [hour, setHour] = useState<string | null>(value ? value.slice(0, 2) : null);
  const minH = min ? min.slice(0, 2) : null;
  const { open, setOpen, ref } = usePopover();
  const pad2 = (n: number) => String(n).padStart(2, "0");

  return (
    <div ref={ref} className="relative">
      <input type="hidden" name={name} value={value} />
      <button
        type="button"
        onClick={() => {
          if (!value && minH) setHour(minH);
          setOpen(!open);
        }}
        className={fieldCls}
      >
        <span className={value ? "" : "text-slate-400"}>{value || labels.placeholder}</span>
        <ClockIcon />
      </button>
      {open && <Backdrop onClose={() => setOpen(false)} />}
      {open && (
        <div className={popCls}>
          <p className="mb-1 text-xs font-medium text-slate-500">{labels.hours}</p>
          <div className="grid grid-cols-6 gap-1 text-center text-sm">
            {Array.from({ length: 24 }, (_, h) => pad2(h)).map((h) => (
              <button
                type="button"
                key={h}
                disabled={!!minH && h < minH}
                onClick={() => {
                  setHour(h);
                  // минуты подбираем так, чтобы время было позже min
                  let m = value ? value.slice(3) : "00";
                  if (min && `${h}:${m}` <= min) m = h === minH ? String(Math.min(55, (Math.floor(Number(min.slice(3)) / 5) + 1) * 5)).padStart(2, "0") : "00";
                  if (!(min && `${h}:${m}` <= min)) setValue(`${h}:${m}`);
                }}
                className={`rounded-lg py-1.5 ${
                  hour === h
                    ? "bg-emerald-600 font-semibold text-white"
                    : minH && h < minH
                      ? "cursor-not-allowed text-slate-300"
                      : "text-slate-700 active:bg-slate-100"
                }`}
              >
                {h}
              </button>
            ))}
          </div>
          <p className="mt-3 mb-1 text-xs font-medium text-slate-500">{labels.minutes}</p>
          <div className="grid grid-cols-6 gap-1 text-center text-sm">
            {Array.from({ length: 12 }, (_, i) => pad2(i * 5)).map((m) => (
              <button
                type="button"
                key={m}
                disabled={!!min && `${hour ?? "12"}:${m}` <= min}
                onClick={() => {
                  setValue(`${hour ?? "12"}:${m}`);
                  if (!hour) setHour("12");
                  setOpen(false);
                }}
                className={`rounded-lg py-1.5 ${
                  value.slice(3) === m && value && value.slice(0, 2) === hour
                    ? "bg-emerald-600 font-semibold text-white"
                    : min && `${hour ?? "12"}:${m}` <= min
                      ? "cursor-not-allowed text-slate-300"
                      : "text-slate-700 active:bg-slate-100"
                }`}
              >
                :{m}
              </button>
            ))}
          </div>
          {value && (
            <div className="mt-2 text-right">
              <button
                type="button"
                onClick={() => {
                  setValue("");
                  setHour(null);
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

/** Даты и время события: «до» никогда не раньше «от». */
export function EventDateTimeFields({
  start,
  end,
  startTime,
  endTime,
  labels,
}: {
  start?: string | null;
  end?: string | null;
  startTime?: string | null;
  endTime?: string | null;
  labels: {
    dates: Labels;
    start: string;
    end: string;
    withTime: string;
    from: string;
    to: string;
    pickTime: string;
    hours: string;
    minutes: string;
  };
}) {
  const [s, setS] = useState(start ?? "");
  const [e, setE] = useState(end && (!start || end >= start) ? end : "");
  const [on, setOn] = useState(!!startTime);
  const [st, setSt] = useState(startTime ?? "");
  const [et, setEt] = useState(endTime ?? "");
  const lbl = "mb-1 block text-xs font-medium text-slate-500";
  const sameDay = !e || e === s;
  const timeLabels = { placeholder: labels.pickTime, hours: labels.hours, minutes: labels.minutes, clear: labels.dates.clear };

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className={lbl}>{labels.start}</label>
          <DatePicker
            name="start"
            labels={labels.dates}
            value={s}
            onChange={(v) => {
              setS(v);
              if (e && v && e < v) setE(""); // конец стал раньше начала — сбрасываем
              if (!v) setOn(false);
            }}
          />
        </div>
        <div>
          <label className={lbl}>{labels.end}</label>
          <DatePicker
            name="end"
            labels={labels.dates}
            value={e}
            min={s || null}
            onChange={(v) => {
              setE(v);
              if ((!v || v === s) && et && st && et <= st) setEt("");
            }}
          />
        </div>
      </div>

      {s && (
        <div className="space-y-2">
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" name="withTime" checked={on} onChange={(ev) => setOn(ev.target.checked)} className="h-5 w-5 accent-emerald-600" />
            🕒 {labels.withTime}
          </label>
          {on && (
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className={lbl}>{labels.from}</label>
                <TimePicker
                  name="startTime"
                  labels={timeLabels}
                  value={st}
                  onChange={(v) => {
                    setSt(v);
                    if (sameDay && et && v && et <= v) setEt("");
                  }}
                />
              </div>
              <div>
                <label className={lbl}>{labels.to}</label>
                <TimePicker name="endTime" labels={timeLabels} value={et} onChange={setEt} min={sameDay && st ? st : null} />
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/** Галочка «Указать время» и поля «с» / «до». */
export function TimeFields({
  start,
  end,
  labels,
}: {
  start?: string | null;
  end?: string | null;
  labels: { withTime: string; from: string; to: string; placeholder: string; hours: string; minutes: string; clear: string };
}) {
  const [on, setOn] = useState(!!start);
  const lbl = "mb-1 block text-xs font-medium text-slate-500";
  const pickerLabels = { placeholder: labels.placeholder, hours: labels.hours, minutes: labels.minutes, clear: labels.clear };
  return (
    <div className="space-y-2">
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" name="withTime" checked={on} onChange={(e) => setOn(e.target.checked)} className="h-5 w-5 accent-emerald-600" />
        🕒 {labels.withTime}
      </label>
      {on && (
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className={lbl}>{labels.from}</label>
            <TimePicker name="startTime" defaultValue={start} labels={pickerLabels} />
          </div>
          <div>
            <label className={lbl}>{labels.to}</label>
            <TimePicker name="endTime" defaultValue={end} labels={pickerLabels} />
          </div>
        </div>
      )}
    </div>
  );
}
