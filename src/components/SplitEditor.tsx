"use client";

import { useEffect, useRef, useState } from "react";

type P = { id: string; name: string };

const num = (s: string) => {
  const n = Number(String(s).replace(/\s| /g, "").replace(",", "."));
  return Number.isFinite(n) ? n : 0;
};

/**
 * Разделение траты: поровну или своими суммами.
 * В режиме «свои суммы» пустые поля получают остаток (поровну между собой).
 * Общая сумма берётся из поля name="amount" той же формы.
 */
export default function SplitEditor({
  parts,
  initial,
  initialAmount,
  t,
}: {
  parts: P[];
  initial?: { mode: "equal" | "custom"; chosen: string[]; amounts: Record<string, string> };
  initialAmount?: string;
  t: { splitBetween: string; equal: string; custom: string; rest: string; over: string; left: string };
}) {
  const [mode, setMode] = useState<"equal" | "custom">(initial?.mode ?? "equal");
  const [chosen, setChosen] = useState<string[]>(initial?.chosen ?? parts.map((p) => p.id));
  const [amounts, setAmounts] = useState<Record<string, string>>(initial?.amounts ?? {});
  const [total, setTotal] = useState(num(initialAmount ?? ""));
  const box = useRef<HTMLDivElement>(null);

  // Следим за полем «Сумма» в форме.
  useEffect(() => {
    const form = box.current?.closest("form");
    const input = form?.querySelector<HTMLInputElement>('input[name="amount"]');
    if (!input) return;
    const update = () => setTotal(num(input.value));
    update();
    input.addEventListener("input", update);
    return () => input.removeEventListener("input", update);
  }, []);

  const inSplit = parts.filter((p) => chosen.includes(p.id));
  const fixed = inSplit.filter((p) => amounts[p.id]?.trim());
  const blank = inSplit.filter((p) => !amounts[p.id]?.trim());
  const fixedSum = fixed.reduce((a, p) => a + num(amounts[p.id]), 0);
  const rest = total - fixedSum;
  const perBlank = blank.length ? Math.max(rest, 0) / blank.length : 0;
  const fmt = (n: number) => new Intl.NumberFormat(undefined, { maximumFractionDigits: 2 }).format(n);

  const toggle = (id: string) => setChosen((c) => (c.includes(id) ? c.filter((x) => x !== id) : [...c, id]));

  return (
    <div ref={box} className="space-y-2">
      <input type="hidden" name="splitMode" value={mode} />
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-slate-500">{t.splitBetween}</span>
        <div className="flex rounded-lg bg-slate-100 p-0.5 text-xs">
          {(["equal", "custom"] as const).map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => setMode(m)}
              className={`rounded-md px-2.5 py-1 font-medium ${mode === m ? "bg-white text-emerald-700 shadow-sm" : "text-slate-500"}`}
            >
              {m === "equal" ? t.equal : t.custom}
            </button>
          ))}
        </div>
      </div>

      {parts.map((p) => {
        const on = chosen.includes(p.id);
        return (
          <div key={p.id} className="flex items-center gap-2">
            <label className="flex min-w-0 flex-1 cursor-pointer items-center gap-2 text-sm">
              <input type="checkbox" name="split" value={p.id} checked={on} onChange={() => toggle(p.id)} className="h-5 w-5 accent-emerald-600" />
              <span className={`truncate ${on ? "" : "text-slate-400"}`}>{p.name}</span>
            </label>
            {on &&
              (mode === "custom" ? (
                <input
                  name={`share_${p.id}`}
                  inputMode="decimal"
                  value={amounts[p.id] ?? ""}
                  onChange={(e) => setAmounts((a) => ({ ...a, [p.id]: e.target.value }))}
                  placeholder={blank.some((b) => b.id === p.id) ? `${t.rest} ${fmt(perBlank)}` : ""}
                  className="w-32 rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-right text-sm text-slate-900 outline-none focus:border-emerald-500"
                />
              ) : (
                <span className="w-32 text-right text-sm text-slate-500">{fmt(inSplit.length ? total / inSplit.length : 0)}</span>
              ))}
          </div>
        );
      })}

      {mode === "custom" && total > 0 && blank.length === 0 && Math.abs(rest) > 0.009 && (
        <p className={`text-xs ${rest < 0 ? "text-rose-600" : "text-amber-700"}`}>{rest < 0 ? t.over.replace("{x}", fmt(-rest)) : t.left.replace("{x}", fmt(rest))}</p>
      )}
      {mode === "custom" && rest < -0.009 && blank.length > 0 && <p className="text-xs text-rose-600">{t.over.replace("{x}", fmt(-rest))}</p>}
    </div>
  );
}
