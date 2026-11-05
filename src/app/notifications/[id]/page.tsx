import { and, eq } from "drizzle-orm";
import { redirect } from "next/navigation";
import { db } from "@/db";
import { notifications } from "@/db/schema";
import { requireUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

/** Открыть уведомление: отметить прочитанным и перейти туда, к чему оно относится. */
export default async function OpenNotification({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) redirect("/notifications");
  const [n] = await db
    .update(notifications)
    .set({ readAt: new Date() })
    .where(and(eq(notifications.id, id), eq(notifications.userId, user.id)))
    .returning({ url: notifications.url });
  const url = n?.url && n.url.startsWith("/") && !n.url.startsWith("//") ? n.url : "/notifications";
  redirect(url);
}
