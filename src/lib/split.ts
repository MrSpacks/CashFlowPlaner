import { and, asc, eq, inArray } from "drizzle-orm";
import { db } from "@/db";
import { eventParticipants, expenseShares, settlements } from "@/db/schema";
import type { EventRow, ItemRow, ParticipantRow, PaymentRow, SettlementRow, ShareRow } from "./events";

/** Создатель события всегда участник (для старых событий — досоздаём). */
export async function ensureCreatorParticipant(ev: EventRow, creatorName: string) {
  const [p] = await db
    .select()
    .from(eventParticipants)
    .where(and(eq(eventParticipants.eventId, ev.id), eq(eventParticipants.userId, ev.createdBy)))
    .limit(1);
  if (p) return p;
  const [created] = await db
    .insert(eventParticipants)
    .values({ eventId: ev.id, userId: ev.createdBy, displayName: creatorName || "—", role: "owner" })
    .returning();
  return created;
}

export async function getSplitData(eventIds: string[]) {
  if (eventIds.length === 0)
    return { parts: [] as ParticipantRow[], shares: [] as ShareRow[], setts: [] as SettlementRow[] };
  const parts = await db
    .select()
    .from(eventParticipants)
    .where(inArray(eventParticipants.eventId, eventIds))
    .orderBy(asc(eventParticipants.createdAt));
  const setts = await db.select().from(settlements).where(inArray(settlements.eventId, eventIds));
  const shares = parts.length
    ? await db.select().from(expenseShares).where(inArray(expenseShares.participantId, parts.map((p) => p.id)))
    : [];
  return { parts, shares, setts };
}

/** Кто платит за трату: явно указанный, иначе создатель события. */
export function payerOf(item: ItemRow, ev: EventRow, parts: ParticipantRow[]) {
  return item.paidByParticipantId ?? parts.find((p) => p.eventId === ev.id && p.userId === ev.createdBy)?.id ?? null;
}

/**
 * Доли участников в трате (сумма в валюте траты).
 * Нет записей о долях → поровну на всех участников события.
 */
export function sharesOf(item: ItemRow, eventParts: ParticipantRow[], shares: ShareRow[]): Map<string, number> {
  const amount = Number(item.amount);
  const rows = shares.filter((s) => s.expenseItemId === item.id && eventParts.some((p) => p.id === s.participantId));
  const res = new Map<string, number>();
  if (rows.length === 0) {
    if (eventParts.length === 0) return res;
    for (const p of eventParts) res.set(p.id, amount / eventParts.length);
    return res;
  }
  const fixed = rows.filter((r) => r.shareType === "amount");
  const fixedSum = fixed.reduce((a, r) => a + Number(r.value ?? 0), 0);
  const pct = rows.filter((r) => r.shareType === "percent");
  const equal = rows.filter((r) => r.shareType === "equal");
  for (const r of fixed) res.set(r.participantId, Number(r.value ?? 0));
  const rest = Math.max(amount - fixedSum, 0);
  let pctUsed = 0;
  for (const r of pct) {
    const v = (rest * Number(r.value ?? 0)) / 100;
    pctUsed += v;
    res.set(r.participantId, v);
  }
  const left = Math.max(rest - pctUsed, 0);
  for (const r of equal) res.set(r.participantId, left / equal.length);
  return res;
}

export interface Balance {
  participantId: string;
  paid: number; // сколько заплатил (по оплаченным тратам)
  owes: number; // его доля в оплаченных тратах
  shareTotal: number; // его доля во всём бюджете события
  net: number; // >0 — ему должны, <0 — он должен
}

/** Балансы события в валюте события (траты в других валютах пересчитываются convert). */
export function eventBalances(
  ev: EventRow,
  items: ItemRow[],
  pays: PaymentRow[],
  parts: ParticipantRow[],
  shares: ShareRow[],
  setts: SettlementRow[],
  convert: (amount: number, currency: string) => number = (a) => a,
) {
  const eventParts = parts.filter((p) => p.eventId === ev.id);
  const bal = new Map<string, Balance>(
    eventParts.map((p) => [p.id, { participantId: p.id, paid: 0, owes: 0, shareTotal: 0, net: 0 }]),
  );

  for (const it of items.filter((i) => i.eventId === ev.id)) {
    const sh = sharesOf(it, eventParts, shares);
    const paidAmount =
      it.status === "paid"
        ? Number(it.amount)
        : pays.filter((p) => p.expenseItemId === it.id && p.currency === it.currency).reduce((a, p) => a + Number(p.amount), 0);
    const ratio = Number(it.amount) > 0 ? paidAmount / Number(it.amount) : 0;
    for (const [pid, v] of sh) {
      const b = bal.get(pid);
      if (!b) continue;
      b.shareTotal += convert(v, it.currency);
      b.owes += convert(v * ratio, it.currency);
    }
    const payer = payerOf(it, ev, parts);
    const pb = payer ? bal.get(payer) : undefined;
    if (pb) pb.paid += convert(paidAmount, it.currency);
  }

  for (const b of bal.values()) b.net = b.paid - b.owes;
  // Возврат: from отдал деньги to → долг from уменьшается, to — получил.
  for (const s of setts.filter((x) => x.eventId === ev.id)) {
    const v = convert(Number(s.amount), s.currency);
    const f = bal.get(s.fromParticipantId);
    const t = bal.get(s.toParticipantId);
    if (f) f.net += v;
    if (t) t.net -= v;
  }
  return [...bal.values()];
}

/** Минимальный набор переводов «кто → кому», чтобы всех рассчитать. */
export function transfers(balances: Balance[], eps = 0.5) {
  const debtors = balances.filter((b) => b.net < -eps).map((b) => ({ id: b.participantId, v: -b.net }));
  const creditors = balances.filter((b) => b.net > eps).map((b) => ({ id: b.participantId, v: b.net }));
  debtors.sort((a, b) => b.v - a.v);
  creditors.sort((a, b) => b.v - a.v);
  const res: { from: string; to: string; amount: number }[] = [];
  let i = 0;
  let j = 0;
  while (i < debtors.length && j < creditors.length) {
    const x = Math.min(debtors[i].v, creditors[j].v);
    if (x > eps) res.push({ from: debtors[i].id, to: creditors[j].id, amount: Math.round(x * 100) / 100 });
    debtors[i].v -= x;
    creditors[j].v -= x;
    if (debtors[i].v <= eps) i++;
    if (creditors[j].v <= eps) j++;
  }
  return res;
}
