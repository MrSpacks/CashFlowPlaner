import { addGoal, deleteGoal, depositToGoal, updateGoal } from "@/app/actions";
import Confetti from "@/components/Confetti";
import CountUp from "@/components/CountUp";
import DatePicker from "@/components/DatePicker";
import PageHeader from "@/components/PageHeader";
import { btnCls, btnGhostCls, Card, CurrencySelect, inputCls, labelCls } from "@/components/ui";
import { dateLabels, type Dict } from "@/i18n/dictionaries";
import { getI18n } from "@/i18n/server";
import { requireUser } from "@/lib/auth";
import { formatDate, formatMoney, monthLabel } from "@/lib/forecast";
import { canUseInvest } from "@/lib/invest";
import { getWealth } from "@/lib/wealth";

export const dynamic = "force-dynamic";

type Goal = Awaited<ReturnType<typeof getWealth>>["goals"][number];

function GoalFields({ t, g, base, invest }: { t: Dict; g?: Goal; base: string; invest: boolean }) {
  return (
    <>
      <div className="grid grid-cols-[64px_1fr] gap-2">
        <div>
          <label className={labelCls}>{t.wl.emoji}</label>
          <input name="emoji" defaultValue={g?.emoji ?? "🎯"} maxLength={8} className={`${inputCls} text-center`} />
        </div>
        <div>
          <label className={labelCls}>{t.wl.goalName}</label>
          <input name="title" required defaultValue={g?.title} placeholder={t.wl.goalPh} className={inputCls} />
        </div>
      </div>
      <div className="grid grid-cols-[1fr_96px] gap-2">
        <div>
          <label className={labelCls}>{t.wl.target}</label>
          <input name="target" inputMode="decimal" required defaultValue={g ? Number(g.target) : undefined} className={inputCls} />
        </div>
        <div>
          <label className={labelCls}>{t.common.currency}</label>
          <CurrencySelect defaultValue={g?.currency ?? base} />
        </div>
      </div>
      <div>
        <label className={labelCls}>{t.wl.source}</label>
        <select name="source" defaultValue={g?.source ?? "manual"} className={inputCls}>
          <option value="manual">{t.wl.srcManual}</option>
          <option value="balance">{t.wl.srcBalance}</option>
          {invest && <option value="invest">{t.wl.srcInvest}</option>}
        </select>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className={labelCls}>{t.wl.saved}</label>
          <input name="saved" inputMode="decimal" defaultValue={g ? Number(g.saved) : ""} placeholder="0" className={inputCls} />
        </div>
        <div>
          <label className={labelCls}>{t.wl.deadline}</label>
          <DatePicker name="deadline" defaultValue={g?.deadline ?? ""} labels={dateLabels(t)} />
        </div>
      </div>
    </>
  );
}

export default async function WealthPage() {
  const user = await requireUser();
  const { t, intl } = await getI18n();
  const w = await getWealth(user.id);
  const m = (n: number) => formatMoney(n, w.base, intl);
  const invest = canUseInvest(user.id);

  // График: столбики по месяцам, снизу деньги на счёте, сверху инвестиции.
  const max = Math.max(1, ...w.history.map((h) => h.balance + h.invest));
  const H = 120;
  const bw = w.history.length ? 100 / w.history.length : 100;

  return (
    <>
      <PageHeader title={`💰 ${t.wl.title}`} subtitle={t.wl.hint} />
      <div className="space-y-4 px-4">
        <Card>
          <p className="text-sm text-slate-500">{t.wl.total}</p>
          <p className="text-3xl font-bold tabular-nums">
            <CountUp value={w.total} currency={w.base} locale={intl} />
          </p>
          <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm">
            <span>
              <span className="mr-1 inline-block h-2.5 w-2.5 rounded-sm bg-emerald-500" />
              {t.wl.balance}: <b className="tabular-nums">{m(w.balanceNow)}</b>
            </span>
            {w.hasInvest && (
              <span>
                <span className="mr-1 inline-block h-2.5 w-2.5 rounded-sm bg-sky-500" />
                {t.wl.invest}: <b className="tabular-nums">{m(w.investNow)}</b>
              </span>
            )}
          </div>

          <p className="mt-4 mb-1 text-xs font-medium text-slate-500">{t.wl.history}</p>
          {w.history.length < 2 ? (
            <p className="text-xs text-slate-400">{t.wl.noHistory}</p>
          ) : (
            <>
              <svg viewBox={`0 0 100 ${H}`} preserveAspectRatio="none" className="h-32 w-full">
                {w.history.map((h, i) => {
                  const bh = (h.balance / max) * (H - 4);
                  const ih = (h.invest / max) * (H - 4);
                  const x = i * bw + bw * 0.15;
                  return (
                    <g key={h.month}>
                      <rect x={x} y={H - bh} width={bw * 0.7} height={bh} rx={0.8} className="cfp-col fill-emerald-500" style={{ animationDelay: `${i * 40}ms` }} />
                      {ih > 0 && <rect x={x} y={H - bh - ih} width={bw * 0.7} height={ih} rx={0.8} className="cfp-col fill-sky-500" style={{ animationDelay: `${i * 40 + 120}ms` }} />}
                    </g>
                  );
                })}
              </svg>
              <div className="flex justify-between text-[11px] text-slate-400">
                <span>{monthLabel(w.history[0].month, t.months)}</span>
                <span>{monthLabel(w.history[w.history.length - 1].month, t.months)}</span>
              </div>
            </>
          )}
          <p className="mt-3 text-xs text-slate-500">{t.wl.pace.replace("{x}", m(w.monthlySaving))}</p>
        </Card>

        <section>
          <h2 className="mb-2 font-semibold">🎯 {t.wl.goals}</h2>
          {w.goals.length === 0 && <p className="mb-3 text-sm text-slate-500">{t.wl.noGoals}</p>}
          <div className="space-y-3">
            {w.goals.map((g) => {
              const pct = g.targetBase > 0 ? Math.min(100, (g.savedBase / g.targetBase) * 100) : 0;
              return (
                <Card key={g.id}>
                  {g.left <= 0 && <Confetti onceKey={`goal-${g.id}`} />}
                  <div className="flex items-start justify-between gap-2">
                    <p className="min-w-0 truncate text-lg font-semibold">
                      {g.emoji} {g.title}
                    </p>
                    <span className="shrink-0 text-sm font-medium tabular-nums text-slate-500">{Math.round(pct)} %</span>
                  </div>
                  <div className="mt-2 h-2.5 overflow-hidden rounded-full bg-slate-100">
                    <div className={`cfp-bar h-full rounded-full ${pct >= 100 ? "bg-emerald-500" : "bg-sky-500"}`} style={{ width: `${pct}%` }} />
                  </div>
                  <p className="mt-1 text-sm tabular-nums">
                    <b>{m(g.savedBase)}</b> <span className="text-slate-400">{t.wl.of} {m(g.targetBase)}</span>
                  </p>
                  <p className="mt-1 text-xs text-slate-500">
                    {g.left <= 0
                      ? t.wl.done
                      : g.perMonthNeeded != null && g.deadline
                        ? t.wl.perMonth.replace("{d}", formatDate(g.deadline, intl)).replace("{x}", m(g.perMonthNeeded))
                        : g.eta
                          ? t.wl.eta.replace("{m}", monthLabel(g.eta, t.months))
                          : t.wl.noEta}
                  </p>

                  {g.source === "manual" && g.left > 0 && (
                    <form action={depositToGoal} className="mt-3 flex gap-2">
                      <input type="hidden" name="id" value={g.id} />
                      <input name="amount" inputMode="decimal" required placeholder="+ 1 000" className={inputCls} />
                      <button className={`${btnCls} shrink-0`}>{t.wl.deposit}</button>
                    </form>
                  )}

                  <details className="group mt-3">
                    <summary className="cursor-pointer list-none text-xs font-medium text-emerald-700 [&::-webkit-details-marker]:hidden">✎ {t.sp.edit}</summary>
                    <div className="mt-2 space-y-3">
                      <form action={updateGoal} className="space-y-3">
                        <input type="hidden" name="id" value={g.id} />
                        <GoalFields t={t} g={g} base={w.base} invest={invest} />
                        <button className={`${btnCls} w-full`}>{t.sp.save}</button>
                      </form>
                      <form action={deleteGoal}>
                        <button name="id" value={g.id} className={`${btnGhostCls} w-full text-rose-600`}>
                          {t.common.delete}
                        </button>
                      </form>
                    </div>
                  </details>
                </Card>
              );
            })}
          </div>
        </section>

        <Card>
          <h2 className="mb-3 font-semibold">＋ {t.wl.addGoal}</h2>
          <form action={addGoal} className="space-y-3">
            <GoalFields t={t} base={w.base} invest={invest} />
            <button className={`${btnCls} w-full`}>{t.common.add}</button>
          </form>
        </Card>
      </div>
    </>
  );
}
