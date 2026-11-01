"use server";

import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { db } from "@/db";
import { balanceSnapshots, events, expenseItems, fixedExpenses, incomes, incomeSources, payments } from "@/db/schema";
import { isLocale } from "@/i18n/dictionaries";
import { auth, requireUser } from "@/lib/auth";
import { EVENT_PRIORITIES, EVENT_STATUSES, EVENT_TYPES, getDefaultCalendarId, getEventForUser } from "@/lib/events";
import { CURRENCIES, parseAmount, todayISO } from "@/lib/forecast";

const str = (fd: FormData, k: string) => String(fd.get(k) ?? "").trim();
const currency = (fd: FormData) => {
  const c = str(fd, "currency").toUpperCase();
  return (CURRENCIES as readonly string[]).includes(c) ? c : "CZK";
};
const day = (fd: FormData, k: string) => {
  const n = parseInt(str(fd, k), 10);
  return Number.isFinite(n) && n >= 1 && n <= 31 ? n : null;
};
const errorCode = (e: unknown) =>
  String((e as { body?: { code?: string } })?.body?.code ?? (e as Error)?.message ?? "");

// ---------- язык ----------
export async function setLanguage(fd: FormData) {
  const lang = str(fd, "lang");
  const jar = await cookies();
  if (isLocale(lang)) jar.set("lang", lang, { path: "/", maxAge: 60 * 60 * 24 * 365, sameSite: "lax" });
  else jar.delete("lang");
  revalidatePath("/", "layout");
}

// ---------- вход / регистрация ----------
export async function signInAction(fd: FormData) {
  let err = "";
  try {
    await auth.api.signInEmail({ body: { email: str(fd, "email"), password: str(fd, "password") }, headers: await headers() });
  } catch (e) {
    err = /INVALID|PASSWORD|NOT_FOUND|CREDENTIAL/i.test(errorCode(e)) ? "invalid" : "generic";
  }
  if (err) redirect(`/login?error=${err}`);
  redirect("/");
}

export async function signUpAction(fd: FormData) {
  let err = "";
  try {
    await auth.api.signUpEmail({
      body: { name: str(fd, "name") || str(fd, "email").split("@")[0], email: str(fd, "email"), password: str(fd, "password") },
      headers: await headers(),
    });
  } catch (e) {
    const code = errorCode(e);
    err = /EXIST/i.test(code) ? "exists" : /PASSWORD/i.test(code) ? "password" : "generic";
  }
  if (err) redirect(`/register?error=${err}`);
  redirect("/");
}

export async function signInGoogleAction() {
  const res = await auth.api.signInSocial({ body: { provider: "google", callbackURL: "/" }, headers: await headers() });
  if (res?.url) redirect(res.url);
  redirect("/login?error=generic");
}

export async function signOutAction() {
  await auth.api.signOut({ headers: await headers() });
  redirect("/login");
}

// ---------- стартовый баланс ----------
export async function saveBalance(fd: FormData) {
  const user = await requireUser();
  const amount = parseAmount(fd.get("amount"));
  if (amount == null) return;
  const asOf = /^\d{4}-\d{2}-\d{2}$/.test(str(fd, "date")) ? str(fd, "date") : todayISO();
  await db.insert(balanceSnapshots).values({ ownerId: user.id, amount: amount.toFixed(2), currency: currency(fd), asOfDate: asOf });
  revalidatePath("/", "layout");
  redirect("/more/balance?saved=1");
}

// ---------- постоянные расходы ----------
export async function addFixedExpense(fd: FormData) {
  const user = await requireUser();
  const amount = parseAmount(fd.get("amount"));
  const name = str(fd, "name");
  if (amount == null || !name) return;
  await db.insert(fixedExpenses).values({
    ownerId: user.id,
    name,
    amount: amount.toFixed(2),
    currency: currency(fd),
    dayOfMonth: day(fd, "day"),
  });
  revalidatePath("/", "layout");
}

export async function deleteFixedExpense(fd: FormData) {
  const user = await requireUser();
  await db.delete(fixedExpenses).where(and(eq(fixedExpenses.id, str(fd, "id")), eq(fixedExpenses.ownerId, user.id)));
  revalidatePath("/", "layout");
}

// ---------- доходы ----------
export async function addIncomeSource(fd: FormData) {
  const user = await requireUser();
  const name = str(fd, "name");
  if (!name) return;
  const isFixed = fd.get("isFixed") === "on";
  const amount = parseAmount(fd.get("amount"));
  await db.insert(incomeSources).values({
    ownerId: user.id,
    name,
    currency: currency(fd),
    payDay: day(fd, "payDay"),
    isFixed,
    defaultAmount: amount == null ? null : amount.toFixed(2),
  });
  revalidatePath("/", "layout");
}

export async function deleteIncomeSource(fd: FormData) {
  const user = await requireUser();
  await db.delete(incomeSources).where(and(eq(incomeSources.id, str(fd, "id")), eq(incomeSources.ownerId, user.id)));
  revalidatePath("/", "layout");
}

/** Сохраняет ожидаемую и/или фактическую сумму дохода за месяц. */
export async function saveIncomeMonth(fd: FormData) {
  const user = await requireUser();
  const sourceId = str(fd, "sourceId");
  const month = str(fd, "month"); // YYYY-MM
  if (!/^\d{4}-\d{2}$/.test(month)) return;
  const [src] = await db
    .select({ id: incomeSources.id })
    .from(incomeSources)
    .where(and(eq(incomeSources.id, sourceId), eq(incomeSources.ownerId, user.id)))
    .limit(1);
  if (!src) return;

  const expected = parseAmount(fd.get("expected"));
  const actual = parseAmount(fd.get("actual"));
  const values = {
    expectedAmount: expected == null ? null : expected.toFixed(2),
    actualAmount: actual == null ? null : actual.toFixed(2),
    receivedAt: actual == null ? null : todayISO(),
  };
  await db
    .insert(incomes)
    .values({ sourceId, month: `${month}-01`, ...values })
    .onConflictDoUpdate({ target: [incomes.sourceId, incomes.month], set: values });
  revalidatePath("/", "layout");
}

// ---------- события ----------
const ISO = /^\d{4}-\d{2}-\d{2}$/;
const isoOrNull = (fd: FormData, k: string) => (ISO.test(str(fd, k)) ? str(fd, k) : null);
const pick = <T extends readonly string[]>(v: string, list: T, fallback: T[number]): T[number] =>
  (list as readonly string[]).includes(v) ? (v as T[number]) : fallback;

function eventFields(fd: FormData) {
  const start = isoOrNull(fd, "start");
  let end = isoOrNull(fd, "end");
  if (start && end && end < start) end = start;
  const status = pick(str(fd, "status"), EVENT_STATUSES, start ? "planned" : "idea");
  return {
    title: str(fd, "title").slice(0, 200),
    type: pick(str(fd, "type"), EVENT_TYPES, "other"),
    startDate: start,
    endDate: end,
    status,
    priority: pick(str(fd, "priority"), EVENT_PRIORITIES, "want"),
    recurrence: fd.get("yearly") === "on" ? ("yearly" as const) : ("none" as const),
    visibility: fd.get("private") === "on" ? ("private" as const) : ("calendar" as const),
    currency: currency(fd),
    notes: str(fd, "notes").slice(0, 2000) || null,
  };
}

export async function createEvent(fd: FormData) {
  const user = await requireUser();
  const fields = eventFields(fd);
  if (!fields.title) return;
  const calendarId = await getDefaultCalendarId(user.id, user.name);
  const [ev] = await db
    .insert(events)
    .values({ ...fields, calendarId, createdBy: user.id })
    .returning({ id: events.id });
  revalidatePath("/", "layout");
  redirect(`/events/${ev.id}`);
}

export async function updateEvent(fd: FormData) {
  const user = await requireUser();
  const ev = await getEventForUser(str(fd, "id"), user.id);
  if (!ev) return;
  const fields = eventFields(fd);
  if (!fields.title) return;
  await db.update(events).set(fields).where(eq(events.id, ev.id));
  revalidatePath("/", "layout");
  redirect(`/events/${ev.id}`);
}

/** Быстрая смена статуса (например, идея → планирую). */
export async function setEventStatus(fd: FormData) {
  const user = await requireUser();
  const ev = await getEventForUser(str(fd, "id"), user.id);
  if (!ev) return;
  await db
    .update(events)
    .set({ status: pick(str(fd, "status"), EVENT_STATUSES, ev.status) })
    .where(eq(events.id, ev.id));
  revalidatePath("/", "layout");
}

export async function deleteEvent(fd: FormData) {
  const user = await requireUser();
  const ev = await getEventForUser(str(fd, "id"), user.id);
  if (!ev) return;
  await db.delete(events).where(eq(events.id, ev.id));
  revalidatePath("/", "layout");
  redirect("/calendar");
}

// ---------- траты события ----------
async function itemForUser(itemId: string, userId: string) {
  if (!/^[0-9a-f-]{36}$/i.test(itemId)) return null;
  const [it] = await db.select().from(expenseItems).where(eq(expenseItems.id, itemId)).limit(1);
  if (!it) return null;
  return (await getEventForUser(it.eventId, userId)) ? it : null;
}

export async function addExpenseItem(fd: FormData) {
  const user = await requireUser();
  const ev = await getEventForUser(str(fd, "eventId"), user.id);
  const amount = parseAmount(fd.get("amount"));
  const title = str(fd, "title").slice(0, 200);
  if (!ev || amount == null || !title) return;
  await db.insert(expenseItems).values({
    eventId: ev.id,
    title,
    amount: amount.toFixed(2),
    currency: currency(fd),
    isEstimate: fd.get("estimate") === "on",
    dueDate: isoOrNull(fd, "due"),
  });
  revalidatePath("/", "layout");
}

export async function deleteExpenseItem(fd: FormData) {
  const user = await requireUser();
  const it = await itemForUser(str(fd, "id"), user.id);
  if (!it) return;
  await db.delete(expenseItems).where(eq(expenseItems.id, it.id));
  revalidatePath("/", "layout");
}

/** Оплачено ↔ не оплачено. При оплате записываем платёж сегодняшним днём. */
export async function toggleExpensePaid(fd: FormData) {
  const user = await requireUser();
  const it = await itemForUser(str(fd, "id"), user.id);
  if (!it) return;
  if (it.status === "paid") {
    await db.delete(payments).where(eq(payments.expenseItemId, it.id));
    await db.update(expenseItems).set({ status: "unpaid" }).where(eq(expenseItems.id, it.id));
  } else {
    const prev = await db.select().from(payments).where(eq(payments.expenseItemId, it.id));
    const already = prev.filter((p) => p.currency === it.currency).reduce((a, p) => a + Number(p.amount), 0);
    const rest = Math.max(Number(it.amount) - already, 0);
    if (rest > 0) {
      await db.insert(payments).values({
        expenseItemId: it.id,
        amount: rest.toFixed(2),
        currency: it.currency,
        paidAt: todayISO(),
      });
    }
    await db.update(expenseItems).set({ status: "paid", isEstimate: false }).where(eq(expenseItems.id, it.id));
  }
  revalidatePath("/", "layout");
}
