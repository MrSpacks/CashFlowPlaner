import Link from "next/link";
import { CURRENCIES } from "@/lib/forecast";

export const inputCls =
  "w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-base text-slate-900 outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20";
export const labelCls = "mb-1 block text-xs font-medium text-slate-500";
export const btnCls =
  "inline-flex items-center justify-center rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white active:bg-emerald-700 disabled:opacity-50";
export const btnGhostCls =
  "inline-flex items-center justify-center rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 active:bg-slate-50";

/** Поверхность карточки — одна на всё приложение. */
export const cardBaseCls = "rounded-2xl bg-white shadow-sm ring-1";
export const cardCls = `${cardBaseCls} ring-slate-200`;
/** Список с разделителями строк. */
export const listCls = "divide-y divide-slate-100";

export function Card({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <div className={`${cardCls} p-4 ${className}`}>{children}</div>;
}

/** Заголовок секции внутри карточки. */
export function SectionTitle({ children, hint }: { children: React.ReactNode; hint?: React.ReactNode }) {
  return (
    <div className="mb-2">
      <h2 className="font-semibold">{children}</h2>
      {hint && <p className="text-xs text-slate-500">{hint}</p>}
    </div>
  );
}

/** Крестик «удалить/убрать» — кнопка внутри формы. */
export function XButton({ label }: { label: string }) {
  return (
    <button aria-label={label} className="p-1 text-slate-300 active:text-rose-600">
      <XIcon />
    </button>
  );
}

export function XIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2}>
      <path d="M6 6l12 12M18 6L6 18" />
    </svg>
  );
}

export function CurrencySelect({ name = "currency", defaultValue = "CZK" }: { name?: string; defaultValue?: string }) {
  return (
    <select name={name} defaultValue={defaultValue} className={inputCls}>
      {CURRENCIES.map((c) => (
        <option key={c} value={c}>
          {c}
        </option>
      ))}
    </select>
  );
}

export function BackLink({ href, label }: { href: string; label: string }) {
  return (
    <Link href={href} className="inline-flex items-center gap-1 px-4 pt-4 text-sm text-emerald-700">
      <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2}>
        <path d="M15 18l-6-6 6-6" />
      </svg>
      {label}
    </Link>
  );
}

export function RowLink({ href, label, hint }: { href: string; label: string; hint?: string }) {
  return (
    <Link href={href} className="flex items-center justify-between px-4 py-3 text-sm active:bg-slate-50">
      <span>{label}</span>
      <span className="flex items-center gap-2 text-xs text-slate-400">
        {hint}
        <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2}>
          <path d="M9 18l6-6-6-6" />
        </svg>
      </span>
    </Link>
  );
}
