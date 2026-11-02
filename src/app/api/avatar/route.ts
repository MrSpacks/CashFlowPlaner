import { eq } from "drizzle-orm";
import { db } from "@/db";
import { avatars, profiles } from "@/db/schema";
import { getSession } from "@/lib/auth";

const TYPES = ["image/jpeg", "image/webp", "image/png"];

/** Загрузка аватарки: картинка уже уменьшена в браузере до 100×100. */
export async function POST(req: Request) {
  const session = await getSession();
  if (!session) return new Response("Unauthorized", { status: 401 });
  const fd = await req.formData();
  const file = fd.get("file");
  if (!(file instanceof Blob) || !TYPES.includes(file.type) || file.size > 80 * 1024) {
    return new Response("Bad image", { status: 400 });
  }
  const data = Buffer.from(await file.arrayBuffer());
  const now = new Date();
  await db
    .insert(avatars)
    .values({ userId: session.user.id, data, mime: file.type, updatedAt: now })
    .onConflictDoUpdate({ target: avatars.userId, set: { data, mime: file.type, updatedAt: now } });
  await db
    .insert(profiles)
    .values({ userId: session.user.id, avatarUpdatedAt: now })
    .onConflictDoUpdate({ target: profiles.userId, set: { avatarUpdatedAt: now } });
  return Response.json({ ok: true });
}

export async function DELETE() {
  const session = await getSession();
  if (!session) return new Response("Unauthorized", { status: 401 });
  await db.delete(avatars).where(eq(avatars.userId, session.user.id));
  await db.update(profiles).set({ avatarUpdatedAt: null }).where(eq(profiles.userId, session.user.id));
  return Response.json({ ok: true });
}
