import { and, desc, eq, gt, inArray, isNotNull, ne, or, sql } from "drizzle-orm";
import { db } from "@/db";
import { chatReads, conversations, eventParticipants, events, messages } from "@/db/schema";
import { getEventAccess } from "./events";

export type Conversation = typeof conversations.$inferSelect;

export async function getOrCreateEventConversation(eventId: string) {
  const [c] = await db.select().from(conversations).where(eq(conversations.eventId, eventId)).limit(1);
  if (c) return c;
  await db.insert(conversations).values({ eventId }).onConflictDoNothing();
  const [created] = await db.select().from(conversations).where(eq(conversations.eventId, eventId)).limit(1);
  return created;
}

export async function getOrCreateDirect(me: string, other: string) {
  const [a, b] = me < other ? [me, other] : [other, me];
  const where = and(eq(conversations.userA, a), eq(conversations.userB, b));
  const [c] = await db.select().from(conversations).where(where).limit(1);
  if (c) return c;
  await db.insert(conversations).values({ userA: a, userB: b }).onConflictDoNothing();
  const [created] = await db.select().from(conversations).where(where).limit(1);
  return created;
}

/** Доступ к чату: участники события / двое в личном. */
export async function getConversationForUser(id: string, userId: string) {
  if (!/^[0-9a-f-]{36}$/i.test(id)) return null;
  const [c] = await db.select().from(conversations).where(eq(conversations.id, id)).limit(1);
  if (!c) return null;
  if (c.eventId) return (await getEventAccess(c.eventId, userId)) ? c : null;
  return c.userA === userId || c.userB === userId ? c : null;
}

/** Кому отправить уведомление о новом сообщении (все, кроме автора). */
export async function recipientsOf(c: Conversation, sender: string): Promise<string[]> {
  if (c.eventId) {
    const [ev] = await db.select({ createdBy: events.createdBy }).from(events).where(eq(events.id, c.eventId)).limit(1);
    const rows = await db
      .select({ u: eventParticipants.userId })
      .from(eventParticipants)
      .where(and(eq(eventParticipants.eventId, c.eventId), isNotNull(eventParticipants.userId)));
    return [...new Set([...rows.map((r) => r.u!), ev?.createdBy].filter((u): u is string => !!u && u !== sender))];
  }
  return [c.userA, c.userB].filter((u): u is string => !!u && u !== sender);
}

export async function markRead(conversationId: string, userId: string) {
  await db
    .insert(chatReads)
    .values({ conversationId, userId, lastReadAt: new Date() })
    .onConflictDoUpdate({ target: [chatReads.conversationId, chatReads.userId], set: { lastReadAt: new Date() } });
}

/** Чаты пользователя: личные + чаты событий, где он участник (только с сообщениями). */
export async function listConversations(userId: string) {
  const myEvents = db.select({ id: eventParticipants.eventId }).from(eventParticipants).where(eq(eventParticipants.userId, userId));
  const ownEvents = db.select({ id: events.id }).from(events).where(eq(events.createdBy, userId));
  const convs = await db
    .select()
    .from(conversations)
    .where(
      and(
        isNotNull(conversations.lastMessageAt),
        or(
          eq(conversations.userA, userId),
          eq(conversations.userB, userId),
          inArray(conversations.eventId, myEvents),
          inArray(conversations.eventId, ownEvents),
        ),
      ),
    )
    .orderBy(desc(conversations.lastMessageAt))
    .limit(100);
  if (convs.length === 0) return [];

  const ids = convs.map((c) => c.id);
  const unread = await db
    .select({ id: messages.conversationId, n: sql<number>`count(*)::int` })
    .from(messages)
    .leftJoin(chatReads, and(eq(chatReads.conversationId, messages.conversationId), eq(chatReads.userId, userId)))
    .where(
      and(
        inArray(messages.conversationId, ids),
        ne(messages.userId, userId),
        sql`${messages.createdAt} > coalesce(${chatReads.lastReadAt}, 'epoch'::timestamptz)`,
      ),
    )
    .groupBy(messages.conversationId);
  // последнее сообщение каждого чата
  const last = await db
    .selectDistinctOn([messages.conversationId], {
      conversationId: messages.conversationId,
      body: messages.body,
      userId: messages.userId,
      createdAt: messages.createdAt,
    })
    .from(messages)
    .where(inArray(messages.conversationId, ids))
    .orderBy(messages.conversationId, desc(messages.createdAt));
  const evIds = convs.map((c) => c.eventId).filter((x): x is string => !!x);
  const evs = evIds.length ? await db.select({ id: events.id, title: events.title, type: events.type }).from(events).where(inArray(events.id, evIds)) : [];

  return convs.map((c) => ({
    ...c,
    unread: unread.find((u) => u.id === c.id)?.n ?? 0,
    last: last.find((l) => l.conversationId === c.id) ?? null,
    event: evs.find((e) => e.id === c.eventId) ?? null,
    other: c.eventId ? null : c.userA === userId ? c.userB : c.userA,
  }));
}

export async function unreadTotal(userId: string) {
  const list = await listConversations(userId);
  return list.reduce((a, c) => a + c.unread, 0);
}

export async function getMessages(conversationId: string, after?: Date, limit = 100) {
  const rows = await db
    .select()
    .from(messages)
    .where(after ? and(eq(messages.conversationId, conversationId), gt(messages.createdAt, after)) : eq(messages.conversationId, conversationId))
    .orderBy(desc(messages.createdAt))
    .limit(limit);
  return rows.reverse();
}
