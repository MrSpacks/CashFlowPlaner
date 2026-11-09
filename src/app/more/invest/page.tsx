import { notFound } from "next/navigation";
import { connectTrading212, disconnectTrading212, refreshInvestments } from "@/app/actions";
import PageHeader from "@/components/PageHeader";
import { BackLink, btnCls, btnGhostCls, Card, inputCls, labelCls, listCls } from "@/components/ui";
import { getI18n } from "@/i18n/server";
import { requireUser } from "@/lib/auth";
import { formatMoney } from "@/lib/forecast";
import { canUseInvest, getInvestAccount, refreshSnapshot } from "@/lib/invest";

export const dynamic = "force-dynamic";

export default async function InvestPage() {
  const user = await requireUser();
  if (!canUseInvest(user.id)) notFound();
  const { t, intl } = await getI18n();
  const acc = await getInvestAccount(user.id);
  const snap = acc ? await refreshSnapshot(user.id, 10) : null;
  const err = acc ? (await getInvestAccount(user.id))?.lastError : null;
  const m = (n: number | string) => formatMoney(Number(n), snap?.currency ?? "EUR", intl);
  const pct = (pl: number, cost: number) => (cost ? `${pl >= 0 ? "+" : ""}${((pl / cost) * 100).toFixed(1)} %` : "");
  const plCls = (n: number) => (n < 0 ? "text-rose-600" : "text-emerald-700");

  return (
    <>
      <BackLink href="/more" label={t.more.title} />
      <PageHeader title={`📈 ${t.inv.title}`} subtitle={t.inv.hint} />
      <div className="space-y-4 px-4">
        {err && (
          <p className="rounded-xl bg-rose-50 px-3 py-2 text-sm text-rose-700">
            {t.inv.error}: {err}
          </p>
        )}

        {!acc && (
          <Card>
            <h2 className="mb-1 font-semibold">{t.inv.connectTitle}</h2>
            <p className="mb-3 text-xs text-slate-500">{t.inv.connectHint}</p>
            <form action={connectTrading212} className="space-y-3" autoComplete="off">
              <div>
                <label className={labelCls}>{t.inv.key}</label>
                <input name="key" required autoComplete="off" spellCheck={false} className={inputCls} />
              </div>
              <div>
                <label className={labelCls}>{t.inv.secret}</label>
                <input name="secret" type="password" required autoComplete="new-password" className={inputCls} />
              </div>
              <div>
                <label className={labelCls}>{t.inv.env}</label>
                <select name="env" defaultValue="live" className={inputCls}>
                  <option value="live">{t.inv.live}</option>
                  <option value="demo">{t.inv.demo}</option>
                </select>
              </div>
              <button className={`${btnCls} w-full`}>{t.inv.connect}</button>
            </form>
          </Card>
        )}

        {acc && !snap && <p className="text-sm text-slate-500">{t.inv.empty}</p>}

        {snap && (
          <>
            <Card>
              <p className="text-sm text-slate-500">{t.inv.total}</p>
              <p className="text-3xl font-bold tabular-nums">{m(snap.totalValue)}</p>
              <p className={`mt-1 text-sm font-medium ${plCls(Number(snap.unrealizedPl))}`}>
                {Number(snap.unrealizedPl) >= 0 ? "+" : ""}
                {m(snap.unrealizedPl)} · {pct(Number(snap.unrealizedPl), Number(snap.totalCost))}
              </p>
              <dl className="mt-4 grid grid-cols-2 gap-3 text-sm">
                <div>
                  <dt className="text-slate-500">{t.inv.invested}</dt>
                  <dd className="font-medium tabular-nums">{m(snap.investedValue)}</dd>
                </div>
                <div>
                  <dt className="text-slate-500">{t.inv.cost}</dt>
                  <dd className="font-medium tabular-nums">{m(snap.totalCost)}</dd>
                </div>
                <div>
                  <dt className="text-slate-500">{t.inv.cash}</dt>
                  <dd className="font-medium tabular-nums">{m(snap.cash)}</dd>
                </div>
                <div>
                  <dt className="text-slate-500">{t.inv.realized}</dt>
                  <dd className={`font-medium tabular-nums ${plCls(Number(snap.realizedPl))}`}>{m(snap.realizedPl)}</dd>
                </div>
              </dl>
              <div className="mt-4 flex items-center justify-between text-xs text-slate-400">
                <span>
                  {t.inv.updated}: {snap.takenAt.toLocaleString(intl, { timeZone: "Europe/Prague", dateStyle: "short", timeStyle: "short" })}
                </span>
                <form action={refreshInvestments}>
                  <button className="font-medium text-emerald-700">↻ {t.inv.refresh}</button>
                </form>
              </div>
            </Card>

            {snap.positions.length > 0 && (
              <section>
                <h2 className="mb-2 font-semibold">{t.inv.positions}</h2>
                <Card className="!p-0">
                  <ul className={listCls}>
                    {snap.positions.map((p) => (
                      <li key={p.ticker} className="flex items-center justify-between gap-3 px-3 py-3">
                        <div className="min-w-0">
                          <p className="truncate font-medium">{p.name}</p>
                          <p className="truncate text-xs text-slate-500">
                            {p.ticker.replace(/_.*$/, "")} · × {Number(p.quantity.toFixed(4))}
                          </p>
                        </div>
                        <div className="shrink-0 text-right text-sm">
                          <p className="font-medium tabular-nums">{m(p.value)}</p>
                          <p className={`text-xs tabular-nums ${plCls(p.pl)}`}>
                            {p.pl >= 0 ? "+" : ""}
                            {m(p.pl)} · {pct(p.pl, p.cost)}
                          </p>
                        </div>
                      </li>
                    ))}
                  </ul>
                </Card>
              </section>
            )}
          </>
        )}

        {acc && (
          <form action={disconnectTrading212}>
            <button className={`${btnGhostCls} w-full text-rose-600`}>{t.inv.disconnect}</button>
          </form>
        )}
      </div>
    </>
  );
}
