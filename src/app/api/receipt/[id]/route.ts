import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { spendings } from "@/db/schema";
import { getSession } from "@/lib/auth";

/** Фото чека — только владельцу траты. */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) return new Response("Unauthorized", { status: 401 });
  const { id } = await params;
  const [r] = await db
    .select({ data: spendings.receipt, type: spendings.receiptType })
    .from(spendings)
    .where(and(eq(spendings.id, id), eq(spendings.ownerId, session.user.id)))
    .limit(1);
  if (!r?.data) return new Response("Not found", { status: 404 });
  return new Response(new Uint8Array(r.data), { headers: { "content-type": r.type ?? "image/jpeg", "cache-control": "private, max-age=3600" } });
}
