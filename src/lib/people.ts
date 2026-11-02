import { and, eq, ilike, inArray, ne, or, sql } from "drizzle-orm";
import { db } from "@/db";
import { authUser, eventParticipants, friendships, profiles } from "@/db/schema";

export type UserInfo = { id: string; name: string; username: string | null; avatar: string | null };

export const USERNAME_RE = /^[a-z0-9_.]{3,20}$/;

export function avatarUrl(userId: string, updatedAt: Date | null | undefined) {
  return updatedAt ? `/api/avatar/${userId}?v=${updatedAt.getTime()}` : null;
}

/** Ник по умолчанию из email/имени: латиница, цифры, точка, подчёркивание. */
function baseUsername(source: string) {
  const b = source
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^a-z0-9_.]/g, "")
    .replace(/^\.+|\.+$/g, "")
    .slice(0, 16);
  return b.length >= 3 ? b : `user${b}`;
}

/** У каждого пользователя должен быть уникальный @ник (создаём при первом обращении). */
export async function ensureUsername(userId: string): Promise<string> {
  const [p] = await db.select({ username: profiles.username }).from(profiles).where(eq(profiles.userId, userId)).limit(1);
  if (p?.username) return p.username;
  const [u] = await db.select({ email: authUser.email, name: authUser.name }).from(authUser).where(eq(authUser.id, userId)).limit(1);
  const base = baseUsername(u?.email?.split("@")[0] || u?.name || "user");
  for (let i = 0; i < 20; i++) {
    const candidate = i === 0 ? base : `${base}${Math.floor(Math.random() * 9000 + 100)}`;
    const [taken] = await db
      .select({ id: profiles.userId })
      .from(profiles)
      .where(sql`lower(${profiles.username}) = ${candidate}`)
      .limit(1);
    if (taken) continue;
    await db.insert(profiles).values({ userId, username: candidate }).onConflictDoUpdate({ target: profiles.userId, set: { username: candidate } });
    return candidate;
  }
  return base;
}

export async function getUsersInfo(ids: string[]): Promise<Map<string, UserInfo>> {
  const uniq = [...new Set(ids.filter(Boolean))];
  if (uniq.length === 0) return new Map();
  const rows = await db
    .select({ id: authUser.id, name: authUser.name, username: profiles.username, av: profiles.avatarUpdatedAt })
    .from(authUser)
    .leftJoin(profiles, eq(profiles.userId, authUser.id))
    .where(inArray(authUser.id, uniq));
  return new Map(rows.map((r) => [r.id, { id: r.id, name: r.name, username: r.username, avatar: avatarUrl(r.id, r.av) }]));
}

export type FriendStatus = "none" | "friends" | "outgoing" | "incoming" | "self";

export async function friendStatus(me: string, other: string): Promise<{ status: FriendStatus; id?: string }> {
  if (me === other) return { status: "self" };
  const [f] = await db
    .select()
    .from(friendships)
    .where(
      or(
        and(eq(friendships.requesterId, me), eq(friendships.addresseeId, other)),
        and(eq(friendships.requesterId, other), eq(friendships.addresseeId, me)),
      ),
    )
    .limit(1);
  if (!f) return { status: "none" };
  if (f.status === "accepted") return { status: "friends", id: f.id };
  return { status: f.requesterId === me ? "outgoing" : "incoming", id: f.id };
}

/** Все связи пользователя: друзья, входящие и исходящие запросы. */
export async function getRelations(me: string) {
  const rows = await db
    .select()
    .from(friendships)
    .where(or(eq(friendships.requesterId, me), eq(friendships.addresseeId, me)));
  const other = (r: (typeof rows)[number]) => (r.requesterId === me ? r.addresseeId : r.requesterId);
  const friends = rows.filter((r) => r.status === "accepted").map((r) => ({ friendshipId: r.id, userId: other(r) }));
  const incoming = rows.filter((r) => r.status === "pending" && r.addresseeId === me).map((r) => ({ friendshipId: r.id, userId: r.requesterId }));
  const outgoing = rows.filter((r) => r.status === "pending" && r.requesterId === me).map((r) => ({ friendshipId: r.id, userId: r.addresseeId }));
  return { friends, incoming, outgoing };
}

export async function countIncomingRequests(me: string) {
  const [r] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(friendships)
    .where(and(eq(friendships.addresseeId, me), eq(friendships.status, "pending")));
  return r?.n ?? 0;
}

/** Открытый поиск: по имени, @нику или точному email. Только тех, кто не скрыл себя. */
export async function searchUsers(me: string, q: string) {
  const term = q.trim().replace(/^@/, "");
  if (term.length < 2) return [];
  const like = `%${term.replace(/[%_\\]/g, "")}%`;
  const rows = await db
    .select({ id: authUser.id })
    .from(authUser)
    .leftJoin(profiles, eq(profiles.userId, authUser.id))
    .where(
      and(
        ne(authUser.id, me),
        or(
          and(
            sql`coalesce(${profiles.searchable}, true)`,
            or(ilike(authUser.name, like), ilike(profiles.username, `${term.replace(/[%_\\]/g, "")}%`)),
          ),
          sql`lower(${authUser.email}) = ${term.toLowerCase()}`,
        ),
      ),
    )
    .limit(20);
  return rows.map((r) => r.id);
}

/** Подсказки: люди из общих событий, которые ещё не друзья. */
export async function suggestions(me: string, exclude: Set<string>) {
  const myEvents = db.select({ id: eventParticipants.eventId }).from(eventParticipants).where(eq(eventParticipants.userId, me));
  const rows = await db
    .selectDistinct({ id: eventParticipants.userId })
    .from(eventParticipants)
    .where(and(inArray(eventParticipants.eventId, myEvents), sql`${eventParticipants.userId} is not null`))
    .limit(30);
  return rows.map((r) => r.id!).filter((id) => id !== me && !exclude.has(id)).slice(0, 10);
}
