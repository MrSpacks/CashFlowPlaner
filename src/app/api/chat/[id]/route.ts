import { getSession } from "@/lib/auth";
import { getConversationForUser, getMessages, markRead } from "@/lib/chat";
import { getUsersInfo } from "@/lib/people";

export const dynamic = "force-dynamic";

/** Новые сообщения после ?after=ISO (опрос из окна чата) + отметка «прочитано». */
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) return new Response("Unauthorized", { status: 401 });
  const { id } = await params;
  const c = await getConversationForUser(id, session.user.id);
  if (!c) return new Response("Not found", { status: 404 });
  const afterParam = new URL(req.url).searchParams.get("after");
  const after = afterParam ? new Date(afterParam) : undefined;
  const list = await getMessages(c.id, after && !isNaN(after.getTime()) ? after : undefined);
  if (list.length) await markRead(c.id, session.user.id);
  const users = await getUsersInfo(list.map((m) => m.userId));
  return Response.json({
    messages: list.map((m) => ({ id: m.id, userId: m.userId, body: m.body, createdAt: m.createdAt.toISOString() })),
    users: Object.fromEntries(users),
  });
}
