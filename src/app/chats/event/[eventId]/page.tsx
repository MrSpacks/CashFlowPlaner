import { notFound, redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { getOrCreateEventConversation } from "@/lib/chat";
import { getEventAccess } from "@/lib/events";

export const dynamic = "force-dynamic";

/** Открыть чат события. */
export default async function EventChat({ params }: { params: Promise<{ eventId: string }> }) {
  const user = await requireUser();
  const { eventId } = await params;
  if (!(await getEventAccess(eventId, user.id))) notFound();
  const c = await getOrCreateEventConversation(eventId);
  redirect(`/chats/${c.id}`);
}
