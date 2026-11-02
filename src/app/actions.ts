"use server";

import { and, eq, isNull, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { db } from "@/db";
import {
  authUser,
  balanceSnapshots,
  calendarInvites,
  calendarMembers,
  calendars,
  eventParticipants,
  events,
  expenseItems,
  expenseShares,
  fixedExpenses,
  incomes,
  incomeSources,
  payments,
  pushSubscriptions,
  settlements,
} from "@/db/schema";
import { DICTIONARIES, isLocale } from "@/i18n/dictionaries";
import { getI18n } from "@/i18n/server";
import { auth, requireUser } from "@/lib/auth";
import { EVENT_PRIORITIES, EVENT_STATUSES, EVENT_TYPES, getDefaultCalendarId, getEditableEvent } from "@/lib/events";
import { CURRENCIES, parseAmount, todayISO } from "@/lib/forecast";
import { sendPushToUser } from "@/lib/push";
import { ensureCreatorParticipant, payerOf } from "@/lib/split";
import { randomBytes } from "node:crypto";

const str = (fd: FormData, k: string) => String(fd.get(k) ?? "").trim();
const currency = (fd: FormData) => {
  const c = str(fd, "currency").toUpperCase();
  return (CURRENCIES as readonly string[]).includes(c) ? c : "CZK";
};
const day = (fd: FormData, k: string) => {
  const n = parseInt(str(fd, k), 10);
  return Number.isFinite(n) && n >= 1 && n <= 31 ? n : null;
};
/** Куда вернуть после входа: только внутренние пути. */
const safeNext = (fd: FormData) => {
  const n = String(fd.get("next") ?? "");
  return n.startsWith("/") && !n.startsWith("//") ? n : "/";
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

// ---------- тема ----------
export async function setTheme(fd: FormData) {
  const v = str(fd, "theme");
  const jar = await cookies();
  if (v === "light" || v === "dark") jar.set("theme", v, { path: "/", maxAge: 60 * 60 * 24 * 365, sameSite: "lax" });
  else jar.delete("theme");
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
  const next = safeNext(fd);
  if (err) redirect(`/login?error=${err}${next !== "/" ? `&next=${encodeURIComponent(next)}` : ""}`);
  redirect(next);
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
  const next = safeNext(fd);
  if (err) redirect(`/register?error=${err}${next !== "/" ? `&next=${encodeURIComponent(next)}` : ""}`);
  redirect(next);
}

export async function signInGoogleAction(fd: FormData) {
  const res = await auth.api.signInSocial({ body: { provider: "google", callbackURL: safeNext(fd) }, headers: await headers() });
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
  await db.insert(eventParticipants).values({ eventId: ev.id, userId: user.id, displayName: user.name || "—", role: "owner" });
  revalidatePath("/", "layout");
  redirect(`/events/${ev.id}`);
}

export async function updateEvent(fd: FormData) {
  const user = await requireUser();
  const ev = await getEditableEvent(str(fd, "id"), user.id);
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
  const ev = await getEditableEvent(str(fd, "id"), user.id);
  if (!ev) return;
  await db
    .update(events)
    .set({ status: pick(str(fd, "status"), EVENT_STATUSES, ev.status) })
    .where(eq(events.id, ev.id));
  revalidatePath("/", "layout");
}

export async function deleteEvent(fd: FormData) {
  const user = await requireUser();
  const ev = await getEditableEvent(str(fd, "id"), user.id);
  if (!ev || ev.createdBy !== user.id) return; // удалить может только автор
  await db.delete(events).where(eq(events.id, ev.id));
  revalidatePath("/", "layout");
  redirect("/calendar");
}

// ---------- траты события ----------
async function itemForUser(itemId: string, userId: string) {
  if (!/^[0-9a-f-]{36}$/i.test(itemId)) return null;
  const [it] = await db.select().from(expenseItems).where(eq(expenseItems.id, itemId)).limit(1);
  if (!it) return null;
  return (await getEditableEvent(it.eventId, userId)) ? it : null;
}

export async function addExpenseItem(fd: FormData) {
  const user = await requireUser();
  const ev = await getEditableEvent(str(fd, "eventId"), user.id);
  const amount = parseAmount(fd.get("amount"));
  const title = str(fd, "title").slice(0, 200);
  if (!ev || amount == null || !title) return;
  const parts = await db.select().from(eventParticipants).where(eq(eventParticipants.eventId, ev.id));
  const payer = parts.find((p) => p.id === str(fd, "payer"));
  const chosen = fd.getAll("split").map(String).filter((id) => parts.some((p) => p.id === id));

  const [item] = await db
    .insert(expenseItems)
    .values({
      eventId: ev.id,
      title,
      amount: amount.toFixed(2),
      currency: currency(fd),
      isEstimate: fd.get("estimate") === "on",
      dueDate: isoOrNull(fd, "due"),
      paidByParticipantId: payer?.id ?? null,
    })
    .returning({ id: expenseItems.id });

  // Делим не на всех — сохраняем, на кого именно (поровну). На всех — без записей,
  // тогда трата делится и на тех, кто присоединится позже.
  if (chosen.length > 0 && chosen.length < parts.length) {
    await db.insert(expenseShares).values(chosen.map((participantId) => ({ expenseItemId: item.id, participantId, shareType: "equal" as const })));
  }
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
      const ev = await getEditableEvent(it.eventId, user.id);
      const parts = ev ? await db.select().from(eventParticipants).where(eq(eventParticipants.eventId, ev.id)) : [];
      await db.insert(payments).values({
        expenseItemId: it.id,
        participantId: ev ? payerOf(it, ev, parts) : null,
        amount: rest.toFixed(2),
        currency: it.currency,
        paidAt: todayISO(),
      });
    }
    await db.update(expenseItems).set({ status: "paid", isEstimate: false }).where(eq(expenseItems.id, it.id));
  }
  revalidatePath("/", "layout");
}

// ---------- участники ----------
const newToken = () => randomBytes(18).toString("base64url");

export async function addParticipant(fd: FormData) {
  const user = await requireUser();
  const ev = await getEditableEvent(str(fd, "eventId"), user.id);
  const input = str(fd, "name").slice(0, 120);
  if (!ev || !input) return;
  await ensureCreatorParticipant(ev, user.id === ev.createdBy ? user.name : "—");

  if (input.includes("@")) {
    const found = await findUserByEmail(input);
    if (found) {
      const [exists] = await db
        .select({ id: eventParticipants.id })
        .from(eventParticipants)
        .where(and(eq(eventParticipants.eventId, ev.id), eq(eventParticipants.userId, found.id)))
        .limit(1);
      if (!exists) {
        await db.insert(eventParticipants).values({ eventId: ev.id, userId: found.id, displayName: found.name, role: "editor" });
        await sendPushToUser(found.id, (loc) => ({
          title: "CashFlowPlaner",
          body: DICTIONARIES[isLocale(loc) ? loc : "en"].pt.pushAdded(user.name, ev.title),
          url: `/events/${ev.id}`,
          tag: `event-${ev.id}`,
        }));
      }
      revalidatePath(`/events/${ev.id}`);
      return;
    }
    // Не зарегистрирован — гость с приглашением по ссылке.
    await db.insert(eventParticipants).values({
      eventId: ev.id,
      displayName: input.split("@")[0].slice(0, 80),
      role: "editor",
      inviteToken: newToken(),
    });
    revalidatePath(`/events/${ev.id}`);
    redirect(`/events/${ev.id}?notfound=1`);
  }

  await db.insert(eventParticipants).values({ eventId: ev.id, displayName: input.slice(0, 80), role: "editor", inviteToken: newToken() });
  revalidatePath(`/events/${ev.id}`);
}

export async function removeParticipant(fd: FormData) {
  const user = await requireUser();
  const [p] = await db.select().from(eventParticipants).where(eq(eventParticipants.id, str(fd, "id"))).limit(1);
  if (!p) return;
  const ev = await getEditableEvent(p.eventId, user.id);
  if (!ev || p.userId === ev.createdBy) return; // создателя не удаляем
  // Траты, которые он оплачивал, переходят на создателя события.
  await db.update(expenseItems).set({ paidByParticipantId: null }).where(eq(expenseItems.paidByParticipantId, p.id));
  await db.delete(eventParticipants).where(eq(eventParticipants.id, p.id));
  revalidatePath(`/events/${ev.id}`);
}

/** Принять приглашение: гостевое место привязывается к аккаунту. */
export async function acceptInvite(fd: FormData) {
  const user = await requireUser();
  const token = str(fd, "token");
  const [p] = await db.select().from(eventParticipants).where(eq(eventParticipants.inviteToken, token)).limit(1);
  if (!p) redirect("/");
  const [already] = await db
    .select({ id: eventParticipants.id })
    .from(eventParticipants)
    .where(and(eq(eventParticipants.eventId, p.eventId), eq(eventParticipants.userId, user.id)))
    .limit(1);
  if (!already && !p.userId) {
    await db.update(eventParticipants).set({ userId: user.id, inviteToken: null }).where(eq(eventParticipants.id, p.id));
  }
  revalidatePath("/", "layout");
  redirect(`/events/${p.eventId}`);
}

/** Отметить возврат долга (from → to). */
export async function addSettlement(fd: FormData) {
  const user = await requireUser();
  const ev = await getEditableEvent(str(fd, "eventId"), user.id);
  const amount = parseAmount(fd.get("amount"));
  if (!ev || amount == null || amount <= 0) return;
  const parts = await db.select().from(eventParticipants).where(eq(eventParticipants.eventId, ev.id));
  const from = parts.find((p) => p.id === str(fd, "from"));
  const to = parts.find((p) => p.id === str(fd, "to"));
  if (!from || !to || from.id === to.id) return;
  await db.insert(settlements).values({
    eventId: ev.id,
    fromParticipantId: from.id,
    toParticipantId: to.id,
    amount: amount.toFixed(2),
    currency: ev.currency,
    settledAt: todayISO(),
  });
  revalidatePath("/", "layout");
}

export async function deleteSettlement(fd: FormData) {
  const user = await requireUser();
  const [st] = await db.select().from(settlements).where(eq(settlements.id, str(fd, "id"))).limit(1);
  if (!st || !(await getEditableEvent(st.eventId, user.id))) return;
  await db.delete(settlements).where(eq(settlements.id, st.id));
  revalidatePath("/", "layout");
}

// ---------- общий календарь ----------
export async function createCalendarInvite(fd: FormData) {
  const user = await requireUser();
  const calendarId = await getDefaultCalendarId(user.id, user.name);
  const role = str(fd, "role") === "editor" ? "editor" : "viewer";
  await db.insert(calendarInvites).values({
    calendarId,
    token: newToken(),
    role,
    createdBy: user.id,
    expiresAt: new Date(Date.now() + 14 * 24 * 3600 * 1000),
  });
  revalidatePath("/more/sharing");
}

export async function revokeCalendarInvite(fd: FormData) {
  const user = await requireUser();
  await db.delete(calendarInvites).where(and(eq(calendarInvites.id, str(fd, "id")), eq(calendarInvites.createdBy, user.id)));
  revalidatePath("/more/sharing");
}

export async function acceptCalendarInvite(fd: FormData) {
  const user = await requireUser();
  const [inv] = await db.select().from(calendarInvites).where(eq(calendarInvites.token, str(fd, "token"))).limit(1);
  if (!inv || inv.acceptedBy || (inv.expiresAt && inv.expiresAt < new Date())) redirect("/join/invalid");
  if (inv.inviteeUserId && inv.inviteeUserId !== user.id) redirect("/join/invalid");
  const [cal] = await db.select().from(calendars).where(eq(calendars.id, inv.calendarId)).limit(1);
  if (cal && cal.ownerId !== user.id) {
    await db
      .insert(calendarMembers)
      .values({ calendarId: inv.calendarId, userId: user.id, role: inv.role })
      .onConflictDoUpdate({ target: [calendarMembers.calendarId, calendarMembers.userId], set: { role: inv.role } });
  }
  await db.update(calendarInvites).set({ acceptedBy: user.id }).where(eq(calendarInvites.id, inv.id));
  revalidatePath("/", "layout");
  redirect("/calendar");
}

export async function removeCalendarMember(fd: FormData) {
  const user = await requireUser();
  const calendarId = await getDefaultCalendarId(user.id, user.name);
  await db
    .delete(calendarMembers)
    .where(and(eq(calendarMembers.calendarId, calendarId), eq(calendarMembers.userId, str(fd, "userId"))));
  revalidatePath("/", "layout");
}

export async function leaveCalendar(fd: FormData) {
  const user = await requireUser();
  await db
    .delete(calendarMembers)
    .where(and(eq(calendarMembers.calendarId, str(fd, "calendarId")), eq(calendarMembers.userId, user.id)));
  revalidatePath("/", "layout");
}

// ---------- push-уведомления ----------
export async function savePushSubscription(json: string) {
  const user = await requireUser();
  let sub: { endpoint?: string; keys?: { p256dh?: string; auth?: string } };
  try {
    sub = JSON.parse(json);
  } catch {
    return false;
  }
  if (!sub.endpoint?.startsWith("https://") || !sub.keys?.p256dh || !sub.keys?.auth) return false;
  const { locale } = await getI18n();
  const values = { userId: user.id, endpoint: sub.endpoint, p256dh: sub.keys.p256dh, auth: sub.keys.auth, locale };
  await db
    .insert(pushSubscriptions)
    .values(values)
    .onConflictDoUpdate({ target: pushSubscriptions.endpoint, set: values });
  return true;
}

export async function deletePushSubscription(endpoint: string) {
  const user = await requireUser();
  await db
    .delete(pushSubscriptions)
    .where(and(eq(pushSubscriptions.endpoint, endpoint), eq(pushSubscriptions.userId, user.id)));
  return true;
}

export async function sendTestPush() {
  const user = await requireUser();
  const sent = await sendPushToUser(user.id, (loc) => ({
    title: "CashFlowPlaner",
    body: DICTIONARIES[isLocale(loc) ? loc : "en"].rm.pushTest,
    url: "/",
    tag: "test",
  }));
  return sent;
}

async function findUserByEmail(email: string) {
  const [u] = await db
    .select({ id: authUser.id, name: authUser.name })
    .from(authUser)
    .where(eq(sql`lower(${authUser.email})`, email.trim().toLowerCase()))
    .limit(1);
  return u ?? null;
}

/** Приглашение в календарь зарегистрированному пользователю по email. */
export async function inviteToCalendarByEmail(fd: FormData) {
  const user = await requireUser();
  const email = str(fd, "email");
  const role = str(fd, "role") === "viewer" ? "viewer" : "editor";
  const found = email.includes("@") ? await findUserByEmail(email) : null;
  if (!found || found.id === user.id) redirect("/more/sharing?notfound=1");

  const calendarId = await getDefaultCalendarId(user.id, user.name);
  const [member] = await db
    .select({ role: calendarMembers.role })
    .from(calendarMembers)
    .where(and(eq(calendarMembers.calendarId, calendarId), eq(calendarMembers.userId, found.id)))
    .limit(1);
  if (member) {
    await db
      .update(calendarMembers)
      .set({ role })
      .where(and(eq(calendarMembers.calendarId, calendarId), eq(calendarMembers.userId, found.id)));
    redirect("/more/sharing?sent=1");
  }
  // Старые неотвеченные приглашения этому человеку — заменяем новым.
  await db
    .delete(calendarInvites)
    .where(and(eq(calendarInvites.calendarId, calendarId), eq(calendarInvites.inviteeUserId, found.id), isNull(calendarInvites.acceptedBy)));
  await db.insert(calendarInvites).values({
    calendarId,
    token: newToken(),
    role,
    createdBy: user.id,
    inviteeUserId: found.id,
    expiresAt: new Date(Date.now() + 30 * 24 * 3600 * 1000),
  });
  await sendPushToUser(found.id, (loc) => ({
    title: "CashFlowPlaner",
    body: DICTIONARIES[isLocale(loc) ? loc : "en"].sh.pushInvite(user.name),
    url: "/",
    tag: "calendar-invite",
  }));
  revalidatePath("/", "layout");
  redirect("/more/sharing?sent=1");
}

export async function declineCalendarInvite(fd: FormData) {
  const user = await requireUser();
  await db
    .delete(calendarInvites)
    .where(and(eq(calendarInvites.id, str(fd, "id")), eq(calendarInvites.inviteeUserId, user.id)));
  revalidatePath("/", "layout");
}
