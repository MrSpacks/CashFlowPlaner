import { and, eq, gte, lt } from "drizzle-orm";
import { db } from "@/db";
import { spendings } from "@/db/schema";
import { CATEGORIES, type Category } from "./categories";
import { getBudgets, getFixedExpenses, getProfile, getRates } from "./finance";
import { addMonths } from "./forecast";

/** Траты месяца против плана по категориям. Всё в базовой валюте. */
export async function monthBudget(userId: string, month: string) {
  const profile = await getProfile(userId);
  const base = profile.baseCurrency ?? "CZK";
  const from = `${month}-01`;
  const to = `${addMonths(month, 1)}-01`;
  const [list, budgetRows, fixed] = await Promise.all([
    db
      .select({
        id: spendings.id,
        date: spendings.date,
        amount: spendings.amount,
        currency: spendings.currency,
        category: spendings.category,
        note: spendings.note,
        receiptType: spendings.receiptType,
      })
      .from(spendings)
      .where(and(eq(spendings.ownerId, userId), gte(spendings.date, from), lt(spendings.date, to)))
      .orderBy(spendings.date),
    getBudgets(userId),
    getFixedExpenses(userId),
  ]);
  const need = [...list, ...budgetRows, ...fixed].some((x) => x.currency !== base);
  const rates = need ? await getRates(base) : {};
  const toBase = (n: number, cur: string) => (cur === base || !rates[cur] ? n : n / rates[cur]);

  const plan = new Map<string, number>();
  for (const f of fixed) {
    if (!f.category) continue;
    if (f.activeFrom && f.activeFrom.slice(0, 7) > month) continue;
    if (f.activeTo && f.activeTo.slice(0, 7) < month) continue;
    plan.set(f.category, (plan.get(f.category) ?? 0) + toBase(Number(f.amount), f.currency));
  }
  const limits = new Map(budgetRows.map((b) => [b.category, Number(b.monthlyLimit)]));
  for (const b of budgetRows) plan.set(b.category, toBase(Number(b.monthlyLimit), b.currency));

  const spentBy = new Map<string, number>();
  for (const x of list) spentBy.set(x.category, (spentBy.get(x.category) ?? 0) + toBase(Number(x.amount), x.currency));

  const rows = CATEGORIES.map((c: Category) => ({ cat: c, spent: spentBy.get(c) ?? 0, plan: plan.get(c) ?? 0, limit: limits.get(c) ?? null }))
    .filter((r) => r.spent > 0 || r.plan > 0)
    .sort((a, b) => b.spent - a.spent || b.plan - a.plan);
  const total = rows.reduce((a, r) => a + r.spent, 0);
  const totalPlan = rows.reduce((a, r) => a + r.plan, 0);
  return { base, rows, total, totalPlan, list: list.reverse(), limits };
}
