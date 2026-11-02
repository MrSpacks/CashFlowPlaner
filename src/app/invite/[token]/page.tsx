import { eq } from "drizzle-orm";
import Link from "next/link";
import { redirect } from "next/navigation";
import { acceptInvite } from "@/app/actions";
import { Card, btnCls, btnGhostCls } from "@/components/ui";
import { db } from "@/db";
import { authUser, eventParticipants, events } from "@/db/schema";
import { getI18n } from "@/i18n/server";
import { getSession } from "@/lib/auth";
import { TYPE_ICON } from "@/lib/events";
import { formatDate } from "@/lib/forecast";

export const dynamic = "force-dynamic";

export default async function InvitePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const { t, intl } = await getI18n();
  const [p] = token
    ? await db.select().from(eventParticipants).where(eq(eventParticipants.inviteToken, token)).limit(1)
    : [];
  const [ev] = p ? await db.select().from(events).where(eq(events.id, p.eventId)).limit(1) : [];

  if (!p || !ev) {
    return (
      <div className="mx-auto flex min-h-dvh w-full max-w-md items-center px-6">
        <Card className="w-full text-center">
          <p className="text-slate-600">{t.pt.inviteUsed}</p>
          <Link href="/" className={`${btnCls} mt-4 w-full`}>OK</Link>
        </Card>
      </div>
    );
  }

  const [inviter] = await db.select({ name: authUser.name }).from(authUser).where(eq(authUser.id, ev.createdBy)).limit(1);
  const session = await getSession();
  const next = `/invite/${token}`;

  // Уже участник этого события — сразу в событие.
  if (session) {
    const members = await db
      .select({ u: eventParticipants.userId })
      .from(eventParticipants)
      .where(eq(eventParticipants.eventId, ev.id));
    if (members.some((r) => r.u === session.user.id)) redirect(`/events/${ev.id}`);
  }

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-md flex-col justify-center px-6 py-10">
      <Card className="text-center">
        <p className="text-4xl">{TYPE_ICON[ev.type]}</p>
        <p className="mt-2 text-sm text-slate-500">{t.pt.inviteTitle}</p>
        <h1 className="mt-1 text-xl font-bold">{t.pt.inviteText(inviter?.name ?? "—", ev.title)}</h1>
        {ev.startDate && <p className="mt-1 text-sm text-slate-500">{formatDate(ev.startDate, intl)}</p>}
        <p className="mt-3 text-sm text-slate-600">{t.pt.inviteAs(p.displayName)}</p>

        {session ? (
          <form action={acceptInvite} className="mt-5">
            <input type="hidden" name="token" value={token} />
            <button className={`${btnCls} w-full`}>{t.pt.join}</button>
          </form>
        ) : (
          <div className="mt-5 space-y-2">
            <p className="text-sm text-slate-500">{t.pt.inviteLogin}</p>
            <Link href={`/register?next=${encodeURIComponent(next)}`} className={`${btnCls} w-full`}>{t.auth.register}</Link>
            <Link href={`/login?next=${encodeURIComponent(next)}`} className={`${btnGhostCls} w-full`}>{t.auth.login}</Link>
          </div>
        )}
      </Card>
    </div>
  );
}
