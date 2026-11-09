import Link from "next/link";
import { notFound } from "next/navigation";
import { saveDailyFeedback } from "@/app/actions";
import DailyTasks from "@/components/DailyTasks";
import PageHeader from "@/components/PageHeader";
import { btnCls, Card, inputCls, labelCls } from "@/components/ui";
import type { DailyFeedback } from "@/db/schema";
import { getI18n } from "@/i18n/server";
import { requireUser } from "@/lib/auth";
import { canUseDailyPlan, DATE_RE, getDailyPlan, planProgress, recentDailyPlans, userToday } from "@/lib/dailyPlan";

export const dynamic = "force-dynamic";

/** Документ «План финансовой независимости» с вкладкой «План развития» (Claude). */
const PLAN_DOC_URL = "https://claude.ai/artifact/GLWcUGGgAU2GQM2gQQ4kiT#102f3910-8daa";

const fmt = (iso: string, intl: string, opts: Intl.DateTimeFormatOptions) =>
  new Intl.DateTimeFormat(intl, { timeZone: "UTC", ...opts }).format(new Date(`${iso}T12:00:00Z`));

export default async function DailyPlanPage({ searchParams }: { searchParams: Promise<{ date?: string }> }) {
  const user = await requireUser();
  if (!canUseDailyPlan(user.id)) notFound();
  const { t, intl } = await getI18n();
  const today = await userToday(user.id);
  const asked = (await searchParams).date;
  const date = asked && DATE_RE.test(asked) && asked <= today ? asked : today;

  const [plan, recent] = await Promise.all([getDailyPlan(user.id, date), recentDailyPlans(user.id, today, 14)]);
  const fb: DailyFeedback = plan?.feedback ?? {};
  const dateTitle = fmt(date, intl, { weekday: "long", day: "numeric", month: "long" });

  return (
    <>
      <PageHeader title={`📋 ${plan?.headline || t.dp.title}`} subtitle={dateTitle} />
      <div className="space-y-4 px-4">
        {date !== today && (
          <p className="flex items-center justify-between gap-3 rounded-xl bg-amber-50 px-3 py-2 text-sm text-amber-800">
            {t.dp.pastDay}
            <Link href="/plan" className="font-semibold underline">{t.dp.toToday}</Link>
          </p>
        )}

        {!plan && (
          <Card>
            <h2 className="font-semibold">{t.dp.noPlan}</h2>
            <p className="mt-1 text-sm text-slate-500">{t.dp.noPlanHint}</p>
          </Card>
        )}

        {plan && (plan.focus || plan.note) && (
          <Card className="border-l-4 border-emerald-500">
            {plan.focus && (
              <p className="font-semibold">
                {t.dp.focus}: {plan.focus}
              </p>
            )}
            {plan.note && <p className="mt-1 whitespace-pre-line text-sm text-slate-600">{plan.note}</p>}
          </Card>
        )}

        {plan && plan.tasks.length > 0 && (
          <DailyTasks
            key={plan.id}
            planId={plan.id}
            tasks={plan.tasks}
            done={plan.done ?? {}}
            labels={{ progress: t.dp.progress(-1, -2).replace("-1", "{done}").replace("-2", "{total}"), minutes: t.dp.minutes(-1).replace("-1", "{n}") }}
          />
        )}

        {plan && (
          <Card>
            <h2 className="mb-3 font-semibold">{t.dp.checkin}</h2>
            <form action={saveDailyFeedback} className="space-y-4" key={`${plan.id}-${plan.submittedAt?.toISOString() ?? ""}`}>
              <input type="hidden" name="id" value={plan.id} />
              <fieldset>
                <legend className={labelCls}>
                  {t.dp.energy} · {t.dp.energyHint}
                </legend>
                <div className="flex gap-2">
                  {[1, 2, 3, 4, 5].map((n) => (
                    <label key={n} className="flex-1">
                      <input type="radio" name="energy" value={n} defaultChecked={fb.energy === n} className="peer sr-only" />
                      <span className="flex h-11 cursor-pointer items-center justify-center rounded-xl border border-slate-300 text-base font-semibold tabular-nums text-slate-700 peer-checked:border-emerald-600 peer-checked:bg-emerald-600 peer-checked:text-white peer-focus-visible:ring-2 peer-focus-visible:ring-emerald-500/40">
                        {n}
                      </span>
                    </label>
                  ))}
                </div>
              </fieldset>
              {(
                [
                  ["wins", t.dp.wins, t.dp.winsPh],
                  ["blockers", `${t.dp.blockers} · ${t.dp.blockersHint}`, ""],
                  ["fears", t.dp.fears, t.dp.fearsPh],
                  ["other", `${t.dp.other} · ${t.dp.otherHint}`, ""],
                ] as const
              ).map(([name, label, ph]) => (
                <div key={name}>
                  <label htmlFor={`dp-${name}`} className={labelCls}>
                    {label}
                  </label>
                  <textarea id={`dp-${name}`} name={name} rows={3} placeholder={ph} defaultValue={fb[name] ?? ""} className={inputCls} />
                </div>
              ))}
              <button className={`${btnCls} w-full`}>{t.dp.save}</button>
              {plan.submittedAt && <p className="text-center text-sm text-emerald-700">✓ {t.dp.saved}</p>}
            </form>
          </Card>
        )}

        <a
          href={PLAN_DOC_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center justify-between gap-3 rounded-2xl bg-white p-4 text-sm shadow-sm ring-1 ring-slate-200 active:bg-slate-50"
        >
          <span className="font-medium">📄 {t.dp.planDoc}</span>
          <span className="text-emerald-700">↗</span>
        </a>

        {recent.length > 0 && (
          <div>
            <h2 className="mb-2 font-semibold">{t.dp.history}</h2>
            <div className="-mx-4 flex gap-2 overflow-x-auto px-4 py-1">
              {recent.map((p) => {
                const { done, total } = planProgress(p);
                const pct = total ? Math.round((done / total) * 100) : 0;
                const full = total > 0 && done === total;
                const active = p.date === date;
                const bar = full ? "bg-emerald-500" : done > 0 ? "bg-amber-500" : "bg-slate-300";
                return (
                  <Link
                    key={p.id}
                    href={p.date === today ? "/plan" : `/plan?date=${p.date}`}
                    className={`flex w-16 shrink-0 flex-col items-center gap-1 rounded-2xl bg-white px-2 py-2.5 ring-1 ${
                      active ? "ring-2 ring-emerald-500" : "ring-slate-200"
                    }`}
                  >
                    <span className="text-[11px] text-slate-500">{fmt(p.date, intl, { weekday: "short" })}</span>
                    <span className="text-lg leading-none font-semibold tabular-nums">{Number(p.date.slice(8, 10))}</span>
                    <span className={`text-[11px] tabular-nums ${full ? "text-emerald-600" : "text-slate-500"}`}>
                      {full ? "✓" : `${done}/${total}`}
                    </span>
                    <span className="h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
                      <span className={`block h-full rounded-full ${bar}`} style={{ width: `${Math.max(pct, total ? 4 : 0)}%` }} />
                    </span>
                  </Link>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </>
  );
}
