import { eq, inArray } from "drizzle-orm";
import { db } from "@/db";
import {
  balanceSnapshots,
  budgets,
  expenseItems,
  fixedExpenses,
  incomes,
  incomeSources,
  oneTimeIncomes,
  savingsGoals,
  spendings,
} from "@/db/schema";
import { getSession } from "@/lib/auth";
import { listUserEvents } from "@/lib/events";

export const dynamic = "force-dynamic";

/** CSV для Excel/Numbers: разделитель «;», BOM для кириллицы и háčků. */
function csv(rows: Record<string, unknown>[]) {
  if (rows.length === 0) return "﻿";
  const cols = Object.keys(rows[0]);
  const cell = (v: unknown) => {
    const s = v == null ? "" : v instanceof Date ? v.toISOString() : String(v);
    return /[";\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  return "﻿" + [cols.join(";"), ...rows.map((r) => cols.map((c) => cell(r[c])).join(";"))].join("\r\n");
}

/** Выгрузка своих данных: spendings.csv, events.csv, finance.csv, backup.json. */
export async function GET(_req: Request, { params }: { params: Promise<{ kind: string }> }) {
  const session = await getSession();
  if (!session) return new Response("Unauthorized", { status: 401 });
  const uid = session.user.id;
  const { kind } = await params;
  const day = new Date().toISOString().slice(0, 10);
  const file = (body: string, name: string, type: string) =>
    new Response(body, { headers: { "content-type": type, "content-disposition": `attachment; filename="cashflowplaner-${name}-${day}"` } });

  const spent = () =>
    db
      .select({ date: spendings.date, amount: spendings.amount, currency: spendings.currency, category: spendings.category, note: spendings.note })
      .from(spendings)
      .where(eq(spendings.ownerId, uid))
      .orderBy(spendings.date);
  const evRows = async () => {
    const evs = await listUserEvents(uid);
    const its = evs.length ? await db.select().from(expenseItems).where(inArray(expenseItems.eventId, evs.map((e) => e.id))) : [];
    return { evs, its };
  };

  if (kind === "spendings.csv") return file(csv(await spent()), "spendings.csv", "text/csv; charset=utf-8");

  if (kind === "events.csv") {
    const { evs, its } = await evRows();
    const rows = evs.flatMap((e) => {
      const base = { event: e.title, type: e.type, status: e.status, start: e.startDate, end: e.endDate, mine: e.createdBy === uid ? "yes" : "no" };
      const list = its.filter((i) => i.eventId === e.id);
      return list.length
        ? list.map((i) => ({ ...base, expense: i.title, amount: i.amount, currency: i.currency, paid: i.status }))
        : [{ ...base, expense: "", amount: "", currency: "", paid: "" }];
    });
    return file(csv(rows), "events.csv", "text/csv; charset=utf-8");
  }

  if (kind === "finance.csv") {
    const [fixed, sources, bal] = await Promise.all([
      db.select().from(fixedExpenses).where(eq(fixedExpenses.ownerId, uid)),
      db.select().from(incomeSources).where(eq(incomeSources.ownerId, uid)),
      db.select().from(balanceSnapshots).where(eq(balanceSnapshots.ownerId, uid)).orderBy(balanceSnapshots.asOfDate),
    ]);
    const rows = [
      ...fixed.map((f) => ({ kind: "fixed expense", name: f.name, amount: f.amount, currency: f.currency, day: f.dayOfMonth, date: "", category: f.category ?? "" })),
      ...sources.map((s) => ({ kind: "income source", name: s.name, amount: s.defaultAmount ?? "", currency: s.currency, day: s.payDay, date: "", category: "" })),
      ...bal.map((b) => ({ kind: "balance", name: "", amount: b.amount, currency: b.currency, day: "", date: b.asOfDate, category: "" })),
    ];
    return file(csv(rows), "finance.csv", "text/csv; charset=utf-8");
  }

  if (kind === "backup.json") {
    const { evs, its } = await evRows();
    const srcs = await db.select().from(incomeSources).where(eq(incomeSources.ownerId, uid));
    const [fixed, bal, oneTime, spentAll, budgetRows, goals, inc] = await Promise.all([
      db.select().from(fixedExpenses).where(eq(fixedExpenses.ownerId, uid)),
      db.select().from(balanceSnapshots).where(eq(balanceSnapshots.ownerId, uid)),
      db.select().from(oneTimeIncomes).where(eq(oneTimeIncomes.ownerId, uid)),
      spent(),
      db.select().from(budgets).where(eq(budgets.ownerId, uid)),
      db.select().from(savingsGoals).where(eq(savingsGoals.ownerId, uid)),
      srcs.length ? db.select().from(incomes).where(inArray(incomes.sourceId, srcs.map((s) => s.id))) : Promise.resolve([]),
    ]);
    const mine = evs.filter((e) => e.createdBy === uid);
    const body = {
      exportedAt: new Date().toISOString(),
      user: { id: uid, name: session.user.name, email: session.user.email },
      events: mine,
      expenseItems: its.filter((i) => mine.some((e) => e.id === i.eventId)),
      incomeSources: srcs,
      incomes: inc,
      oneTimeIncomes: oneTime,
      fixedExpenses: fixed,
      balanceSnapshots: bal,
      spendings: spentAll,
      budgets: budgetRows,
      savingsGoals: goals,
    };
    return file(JSON.stringify(body, null, 2), "backup.json", "application/json; charset=utf-8");
  }
  return new Response("Not found", { status: 404 });
}
