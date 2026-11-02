import { sql } from "drizzle-orm";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { acceptFriendRequest, removeFriendship, sendFriendRequest } from "@/app/actions";
import Avatar from "@/components/Avatar";
import { Card, btnCls, btnGhostCls } from "@/components/ui";
import { db } from "@/db";
import { profiles } from "@/db/schema";
import { getI18n } from "@/i18n/server";
import { getSession } from "@/lib/auth";
import { friendStatus, getUsersInfo } from "@/lib/people";

export const dynamic = "force-dynamic";

/** Профиль по @нику — сюда ведёт QR-код. */
export default async function UserPage({ params }: { params: Promise<{ username: string }> }) {
  const { username } = await params;
  const session = await getSession();
  if (!session) redirect(`/login?next=${encodeURIComponent(`/u/${username}`)}`);
  const { t } = await getI18n();

  const [p] = await db
    .select({ userId: profiles.userId })
    .from(profiles)
    .where(sql`lower(${profiles.username}) = ${decodeURIComponent(username).toLowerCase()}`)
    .limit(1);
  if (!p) notFound();
  const u = (await getUsersInfo([p.userId])).get(p.userId);
  if (!u) notFound();
  const rel = await friendStatus(session.user.id, u.id);

  return (
    <div className="mx-auto w-full max-w-md px-4 pt-10">
      <Card className="text-center">
        <Avatar name={u.name} src={u.avatar} seed={u.id} size={96} className="mx-auto" />
        <h1 className="mt-3 text-xl font-bold">{u.name}</h1>
        {u.username && <p className="text-sm text-slate-500">@{u.username}</p>}

        <div className="mt-5 space-y-2">
          {rel.status === "self" && (
            <Link href="/profile" className={`${btnGhostCls} w-full`}>{t.pr.title}</Link>
          )}
          {rel.status === "none" && (
            <form action={sendFriendRequest}>
              <input type="hidden" name="userId" value={u.id} />
              <button className={`${btnCls} w-full`}>＋ {t.fr.add}</button>
            </form>
          )}
          {rel.status === "incoming" && rel.id && (
            <>
              <p className="text-sm text-slate-600">{t.fr.wantsFriend}</p>
              <form action={acceptFriendRequest}>
                <input type="hidden" name="id" value={rel.id} />
                <button className={`${btnCls} w-full`}>{t.fr.accept}</button>
              </form>
            </>
          )}
          {rel.status === "outgoing" && <p className="text-sm text-slate-500">{t.fr.pending}</p>}
          {rel.status === "friends" && <p className="text-sm text-emerald-700">✓ {t.fr.isFriend}</p>}
          {rel.status !== "self" && (
            <Link href={`/chats/with/${u.id}`} className={`${btnGhostCls} w-full`}>💬 {t.fr.message}</Link>
          )}
          {rel.status === "friends" && rel.id && (
            <form action={removeFriendship}>
              <input type="hidden" name="id" value={rel.id} />
              <button className="text-xs text-slate-400">{t.fr.remove}</button>
            </form>
          )}
        </div>
      </Card>
    </div>
  );
}
