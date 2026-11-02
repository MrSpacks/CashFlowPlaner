import { eq } from "drizzle-orm";
import { notFound, redirect } from "next/navigation";
import { db } from "@/db";
import { authUser } from "@/db/schema";
import { requireUser } from "@/lib/auth";
import { getOrCreateDirect } from "@/lib/chat";

export const dynamic = "force-dynamic";

/** Открыть (или создать) личный чат с человеком. */
export default async function DirectChat({ params }: { params: Promise<{ userId: string }> }) {
  const user = await requireUser();
  const { userId } = await params;
  if (userId === user.id) redirect("/chats");
  const [other] = await db.select({ id: authUser.id }).from(authUser).where(eq(authUser.id, userId)).limit(1);
  if (!other) notFound();
  const c = await getOrCreateDirect(user.id, other.id);
  redirect(`/chats/${c.id}`);
}
