import { eq } from "drizzle-orm";
import { db } from "@/db";
import { avatars } from "@/db/schema";

/** Картинка аватарки. В ссылке есть ?v=время, поэтому кешируем «навсегда». */
export async function GET(_req: Request, { params }: { params: Promise<{ userId: string }> }) {
  const { userId } = await params;
  const [a] = await db.select().from(avatars).where(eq(avatars.userId, userId)).limit(1);
  if (!a) return new Response("Not found", { status: 404 });
  return new Response(new Uint8Array(a.data), {
    headers: { "content-type": a.mime, "cache-control": "public, max-age=31536000, immutable" },
  });
}
