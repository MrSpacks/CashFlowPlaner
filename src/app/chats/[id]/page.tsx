import { eq } from "drizzle-orm";
import Link from "next/link";
import { notFound } from "next/navigation";
import Avatar from "@/components/Avatar";
import ChatView from "@/components/ChatView";
import { db } from "@/db";
import { events } from "@/db/schema";
import { getI18n } from "@/i18n/server";
import { requireUser } from "@/lib/auth";
import { getConversationForUser, getMessages, markRead } from "@/lib/chat";
import { TYPE_ICON } from "@/lib/events";
import { getUsersInfo } from "@/lib/people";

export const dynamic = "force-dynamic";

export default async function ChatPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  const { id } = await params;
  const c = await getConversationForUser(id, user.id);
  if (!c) notFound();
  const { t, intl } = await getI18n();

  const list = await getMessages(c.id);
  await markRead(c.id, user.id);
  const otherId = c.eventId ? null : c.userA === user.id ? c.userB : c.userA;
  const users = await getUsersInfo([...list.map((m) => m.userId), ...(otherId ? [otherId] : [])]);
  const other = otherId ? users.get(otherId) : null;
  const [ev] = c.eventId ? await db.select().from(events).where(eq(events.id, c.eventId)).limit(1) : [];

  return (
    <div
      className="fixed inset-0 z-30 flex flex-col lg:static lg:z-auto lg:h-[calc(100dvh-3rem)] lg:max-w-2xl"
      style={{ background: "var(--app-bg)" }}
    >
      <header
        className="flex shrink-0 items-center gap-3 border-b border-slate-200 bg-white px-4 py-3"
        style={{ paddingTop: "calc(0.75rem + env(safe-area-inset-top))" }}
      >
        <Link href="/chats" className="text-emerald-700" aria-label={t.common.back}>
          <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={2}>
            <path d="M15 18l-6-6 6-6" />
          </svg>
        </Link>
        {ev ? (
          <Link href={`/events/${ev.id}`} className="flex min-w-0 items-center gap-2">
            <span className="text-2xl">{TYPE_ICON[ev.type]}</span>
            <span className="min-w-0">
              <span className="block truncate font-semibold">{ev.title}</span>
              <span className="block text-xs text-slate-500">{t.ch.eventChat}</span>
            </span>
          </Link>
        ) : other ? (
          <Link href={other.username ? `/u/${other.username}` : "#"} className="flex min-w-0 items-center gap-2">
            <Avatar name={other.name} src={other.avatar} seed={other.id} size={36} />
            <span className="min-w-0">
              <span className="block truncate font-semibold">{other.name}</span>
              {other.username && <span className="block text-xs text-slate-500">@{other.username}</span>}
            </span>
          </Link>
        ) : null}
      </header>
      <div className="flex min-h-0 flex-1 flex-col">
        <ChatView
          conversationId={c.id}
          me={user.id}
          initial={list.map((m) => ({ id: m.id, userId: m.userId, body: m.body, createdAt: m.createdAt.toISOString() }))}
          initialUsers={Object.fromEntries(users)}
          intl={intl}
          t={{ placeholder: t.ch.placeholder, send: t.ch.send, empty: t.ch.empty }}
          showNames={!!c.eventId}
        />
      </div>
    </div>
  );
}
