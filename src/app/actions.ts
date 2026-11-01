"use server";

import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { db } from "@/db";
import { balanceSnapshots, fixedExpenses, incomes, incomeSources } from "@/db/schema";
import { isLocale } from "@/i18n/dictionaries";
import { auth, requireUser } from "@/lib/auth";
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
