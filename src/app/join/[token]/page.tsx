import { eq } from "drizzle-orm";
import Link from "next/link";
import { acceptCalendarInvite } from "@/app/actions";
import { Card, btnCls, btnGhostCls } from "@/components/ui";
import { db } from "@/db";
import { authUser, calendarInvites, calendars } from "@/db/schema";
import { getI18n } from "@/i18n/server";
import { getSession } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function JoinPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const { t } = await getI18n();
  const [inv] = await db.select().from(calendarInvites).where(eq(calendarInvites.token, token)).limit(1);
  const invalid = (
    <div className="flex min-h-dvh items-center px-6">
      <Card className="w-full text-center">
        <p className="text-slate-600">{t.sh.joinInvalid}</p>
        <Link href="/" className={`${btnCls} mt-4 w-full`}>OK</Link>
      </Card>
    </div>
  );
  if (!inv || inv.acceptedBy || (inv.expiresAt && inv.expiresAt <= new Date())) return invalid;
  const [owner] = await db
    .select({ name: authUser.name })
    .from(calendars)
    .innerJoin(authUser, eq(authUser.id, calendars.ownerId))
    .where(eq(calendars.id, inv.calendarId))
    .limit(1);
  if (!owner) return invalid;

  const session = await getSession();
  const next = `/join/${token}`;

  return (
    <div className="flex min-h-dvh flex-col justify-center px-6 py-10">
      <Card className="text-center">
        <p className="text-4xl">📅</p>
        <p className="mt-2 text-sm text-slate-500">{t.sh.joinTitle}</p>
        <h1 className="mt-1 text-xl font-bold">{t.sh.joinText(owner.name)}</h1>
        <p className="mt-2 text-sm text-slate-600">{t.sh.roles[inv.role]}</p>
        {session ? (
          <form action={acceptCalendarInvite} className="mt-5">
            <input type="hidden" name="token" value={token} />
            <button className={`${btnCls} w-full`}>{t.sh.join}</button>
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
