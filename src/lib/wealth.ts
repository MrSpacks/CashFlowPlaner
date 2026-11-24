import { desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { balanceSnapshots, investmentSnapshots, savingsGoals } from "@/db/schema";
import { buildUserForecast, getProfile, getRates } from "./finance";
import { addMonths, todayISO } from "./forecast";
import { canUseInvest } from "./invest";

/**
 * Общий капитал: баланс счёта + портфель (если подключён), история по месяцам (последний снимок месяца)
 * и цели накоплений с прогрессом и оценкой даты достижения.
 */
export async function getWealth(userId: string) {
  const profile = await getProfile(userId);
  const base = profile.baseCurrency ?? "CZK";
  const invOk = canUseInvest(userId);
  const [bal, inv, goals, forecast] = await Promise.all([
    db.select().from(balanceSnapshots).where(eq(balanceSnapshots.ownerId, userId)).orderBy(desc(balanceSnapshots.asOfDate), desc(balanceSnapshots.createdAt)),
    invOk
      ? db
          .select({ takenAt: investmentSnapshots.takenAt, totalValue: investmentSnapshots.totalValue, currency: investmentSnapshots.currency })
          .from(investmentSnapshots)
          .where(eq(investmentSnapshots.ownerId, userId))
          .orderBy(desc(investmentSnapshots.takenAt))
      : Promise.resolve([] as { takenAt: Date; totalValue: string; currency: string }[]),
    db.select().from(savingsGoals).where(eq(savingsGoals.ownerId, userId)).orderBy(savingsGoals.createdAt),
    buildUserForecast(userId, 12),
  ]);
  const need = [...bal, ...inv, ...goals].some((x) => x.currency !== base);
  const rates = need ? await getRates(base) : {};
  const toBase = (n: number, cur: string) => (cur === base || !rates[cur] ? n : n / rates[cur]);

  const balanceNow = bal[0] ? toBase(Number(bal[0].amount), bal[0].currency) : 0;
  const investNow = inv[0] ? toBase(Number(inv[0].totalValue), inv[0].currency) : 0;

  // История за 12 месяцев: на конец каждого месяца — последний известный баланс и портфель.
  const thisMonth = todayISO(profile.timezone ?? "Europe/Prague").slice(0, 7);
  const history: { month: string; balance: number; invest: number }[] = [];
  for (let i = 11; i >= 0; i--) {
    const m = addMonths(thisMonth, -i);
    const b = bal.find((x) => x.asOfDate.slice(0, 7) <= m);
    const v = inv.find((x) => x.takenAt.toISOString().slice(0, 7) <= m);
    history.push({ month: m, balance: b ? toBase(Number(b.amount), b.currency) : 0, invest: v ? toBase(Number(v.totalValue), v.currency) : 0 });
  }
  const firstData = history.findIndex((h) => h.balance + h.invest > 0);

  // Темп накопления: средний итог месяца (приход − расход) по прогнозу на 12 месяцев.
  const nets = forecast.months.map((mo) => mo.income + mo.refunds - mo.fixed - mo.eventPayments);
  const monthlySaving = nets.length ? nets.reduce((a, n) => a + n, 0) / nets.length : 0;

  const goalRows = goals.map((g) => {
    const target = toBase(Number(g.target), g.currency);
    const saved = g.source === "balance" ? balanceNow : g.source === "invest" ? investNow : toBase(Number(g.saved), g.currency);
    const left = Math.max(target - saved, 0);
    const monthsToGo = left <= 0 ? 0 : monthlySaving > 0 ? Math.ceil(left / monthlySaving) : null;
    const eta = monthsToGo == null ? null : addMonths(thisMonth, monthsToGo);
    let perMonthNeeded: number | null = null;
    if (g.deadline && left > 0) {
      const months = Math.max(1, (Number(g.deadline.slice(0, 4)) - Number(thisMonth.slice(0, 4))) * 12 + Number(g.deadline.slice(5, 7)) - Number(thisMonth.slice(5, 7)));
      perMonthNeeded = left / months;
    }
    return { ...g, targetBase: target, savedBase: saved, left, eta, perMonthNeeded };
  });

  return {
    base,
    balanceNow,
    investNow,
    hasInvest: inv.length > 0,
    total: balanceNow + investNow,
    history: firstData < 0 ? [] : history.slice(firstData),
    monthlySaving,
    goals: goalRows,
  };
}
