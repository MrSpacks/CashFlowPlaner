import { and, eq, gt, inArray, isNull } from "drizzle-orm";
import {
  createCalendarInvite,
  leaveCalendar,
  removeCalendarMember,
  revokeCalendarInvite,
} from "@/app/actions";
import PageHeader from "@/components/PageHeader";
import ShareLink from "@/components/ShareLink";
import { BackLink, Card, btnCls, btnGhostCls } from "@/components/ui";
import { db } from "@/db";
import { authUser, calendarInvites, calendarMembers, calendars } from "@/db/schema";
import { getI18n } from "@/i18n/server";
import { requireUser } from "@/lib/auth";
import { getDefaultCalendarId } from "@/lib/events";
import { formatDate } from "@/lib/forecast";

export const dynamic = "force-dynamic";

const XIcon = () => (
  <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2}>
    <path d="M6 6l12 12M18 6L6 18" />
  </svg>
);

export default async function SharingPage() {
  const user = await requireUser();
  const { t, intl } = await getI18n();
  const calendarId = await getDefaultCalendarId(user.id, user.name);

  const members = await db
    .select({ userId: calendarMembers.userId, role: calendarMembers.role, name: authUser.name, email: authUser.email })
    .from(calendarMembers)
    .innerJoin(authUser, eq(authUser.id, calendarMembers.userId))
    .where(eq(calendarMembers.calendarId, calendarId));

  const invites = await db
    .select()
    .from(calendarInvites)
    .where(
      and(eq(calendarInvites.calendarId, calendarId), isNull(calendarInvites.acceptedBy), gt(calendarInvites.expiresAt, new Date())),
    );

  const mine = await db
    .select({ calendarId: calendarMembers.calendarId, role: calendarMembers.role })
    .from(calendarMembers)
    .where(eq(calendarMembers.userId, user.id));
  const shared = mine.length
    ? await db
        .select({ id: calendars.id, name: calendars.name, owner: authUser.name })
        .from(calendars)
        .innerJoin(authUser, eq(authUser.id, calendars.ownerId))
        .where(inArray(calendars.id, mine.map((m) => m.calendarId)))
    : [];

  return (
    <>
      <BackLink href="/more" label={t.more.title} />
      <PageHeader title={t.sh.title} subtitle={t.sh.hint} />
      <div className="space-y-4 px-4">
        <Card>
          <h2 className="mb-2 font-semibold">{t.sh.members}</h2>
          {members.length === 0 ? (
            <p className="text-sm text-slate-500">{t.sh.noMembers}</p>
          ) : (
            <ul className="divide-y divide-slate-100 text-sm">
              {members.map((m) => (
                <li key={m.userId} className="flex items-center justify-between gap-2 py-2">
                  <div className="min-w-0">
                    <p className="truncate font-medium">{m.name}</p>
                    <p className="truncate text-xs text-slate-400">
                      {m.email} · {t.sh.roles[m.role]}
                    </p>
                  </div>
                  <form action={removeCalendarMember}>
                    <input type="hidden" name="userId" value={m.userId} />
                    <button aria-label={t.sh.removeAccess} className="p-1 text-slate-300 active:text-rose-600">
                      <XIcon />
                    </button>
                  </form>
                </li>
              ))}
            </ul>
          )}

          <div className="mt-4 grid gap-2">
            <form action={createCalendarInvite}>
              <input type="hidden" name="role" value="viewer" />
              <button className={`${btnGhostCls} w-full`}>＋ {t.sh.inviteViewer}</button>
            </form>
            <form action={createCalendarInvite}>
              <input type="hidden" name="role" value="editor" />
              <button className={`${btnCls} w-full`}>＋ {t.sh.inviteEditor}</button>
            </form>
          </div>
        </Card>

        {invites.length > 0 && (
          <Card>
            <h2 className="mb-2 font-semibold">{t.sh.pending}</h2>
            <ul className="divide-y divide-slate-100 text-sm">
              {invites.map((inv) => (
                <li key={inv.id} className="flex items-center justify-between gap-2 py-2">
                  <div className="min-w-0">
                    <p className="font-medium">{t.sh.roles[inv.role]}</p>
                    {inv.expiresAt && (
                      <p className="text-xs text-slate-400">{t.sh.validUntil(formatDate(inv.expiresAt.toISOString().slice(0, 10), intl))}</p>
                    )}
                  </div>
                  <div className="flex shrink-0 items-center gap-1">
                    <ShareLink path={`/join/${inv.token}`} label={t.pt.invite} copiedLabel={t.pt.copied} title={t.sh.title} />
                    <form action={revokeCalendarInvite}>
                      <input type="hidden" name="id" value={inv.id} />
                      <button aria-label={t.sh.revoke} className="p-1 text-slate-300 active:text-rose-600">
                        <XIcon />
                      </button>
                    </form>
                  </div>
                </li>
              ))}
            </ul>
          </Card>
        )}

        {shared.length > 0 && (
          <Card>
            <h2 className="mb-2 font-semibold">{t.sh.sharedWithMe}</h2>
            <ul className="divide-y divide-slate-100 text-sm">
              {shared.map((c) => {
                const role = mine.find((m) => m.calendarId === c.id)?.role ?? "viewer";
                return (
                  <li key={c.id} className="flex items-center justify-between gap-2 py-2">
                    <div className="min-w-0">
                      <p className="truncate font-medium">{c.owner}</p>
                      <p className="text-xs text-slate-400">{t.sh.roles[role]}</p>
                    </div>
                    <form action={leaveCalendar}>
                      <input type="hidden" name="calendarId" value={c.id} />
                      <button className="text-xs text-rose-600">{t.sh.leave}</button>
                    </form>
                  </li>
                );
              })}
            </ul>
          </Card>
        )}
      </div>
    </>
  );
}
