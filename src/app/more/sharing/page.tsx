import { and, eq, gt, inArray, isNull } from "drizzle-orm";
import {
  createCalendarInvite,
  inviteFriendToCalendar,
  inviteToCalendarByEmail,
  leaveCalendar,
  removeCalendarMember,
  revokeCalendarInvite,
} from "@/app/actions";
import PageHeader from "@/components/PageHeader";
import QrCode from "@/components/QrCode";
import ShareLink from "@/components/ShareLink";
import { BackLink, Card, btnCls, btnGhostCls, inputCls } from "@/components/ui";
import { db } from "@/db";
import { authUser, calendarInvites, calendarMembers, calendars } from "@/db/schema";
import { getI18n } from "@/i18n/server";
import { requireUser } from "@/lib/auth";
import { getDefaultCalendarId } from "@/lib/events";
import { getRelations, getUsersInfo } from "@/lib/people";
import Avatar from "@/components/Avatar";
import { formatDate } from "@/lib/forecast";

export const dynamic = "force-dynamic";

const XIcon = () => (
  <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2}>
    <path d="M6 6l12 12M18 6L6 18" />
  </svg>
);

export default async function SharingPage({ searchParams }: { searchParams: Promise<{ sent?: string; notfound?: string }> }) {
  const user = await requireUser();
  const { sent, notfound } = await searchParams;
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

  const inviteeIds = invites.map((i) => i.inviteeUserId).filter((x): x is string => !!x);
  const invitees = inviteeIds.length
    ? await db.select({ id: authUser.id, name: authUser.name }).from(authUser).where(inArray(authUser.id, inviteeIds))
    : [];

  const rel = await getRelations(user.id);
  const friendIds = rel.friends
    .map((f) => f.userId)
    .filter((id) => !members.some((m) => m.userId === id) && !inviteeIds.includes(id));
  const friendInfo = await getUsersInfo(friendIds);

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
  const ownersOfShared = shared.length
    ? await db.select({ id: calendars.id, ownerId: calendars.ownerId }).from(calendars).where(inArray(calendars.id, shared.map((c) => c.id)))
    : [];
  const sharedOnly = shared.filter((c) => !members.some((m) => m.userId === ownersOfShared.find((o) => o.id === c.id)?.ownerId));

  return (
    <>
      <BackLink href="/more" label={t.more.title} />
      <PageHeader title={t.sh.title} subtitle={t.sh.hint} />
      <div className="space-y-4 px-4">
        {sent && <p className="rounded-xl bg-emerald-50 px-3 py-2 text-sm text-emerald-800">✓ {t.sh.sentOk}</p>}
        {notfound && <p className="rounded-xl bg-amber-50 px-3 py-2 text-sm text-amber-800">{t.sh.notFound}</p>}

        {friendIds.length > 0 && (
          <Card>
            <h2 className="mb-2 font-semibold">{t.fr.fromFriends}</h2>
            <div className="flex flex-wrap gap-2">
              {friendIds.map((fid) => {
                const f = friendInfo.get(fid);
                return (
                  <form key={fid} action={inviteFriendToCalendar}>
                    <input type="hidden" name="userId" value={fid} />
                    <input type="hidden" name="role" value="editor" />
                    <button className="inline-flex items-center gap-1.5 rounded-full py-1 pr-3 pl-1 text-sm ring-1 ring-slate-300 active:bg-slate-100">
                      <Avatar name={f?.name ?? "?"} src={f?.avatar} seed={fid} size={24} />
                      {f?.name ?? "—"} ＋
                    </button>
                  </form>
                );
              })}
            </div>
          </Card>
        )}

        <Card>
          <h2 className="font-semibold">{t.sh.byEmail}</h2>
          <p className="mb-3 text-xs text-slate-500">{t.sh.emailHint}</p>
          <form action={inviteToCalendarByEmail} className="space-y-2">
            <input name="email" type="email" required autoComplete="email" placeholder="email@example.com" className={inputCls} />
            <input type="hidden" name="role" value="editor" />
            <button className={`${btnCls} w-full`}>{t.sh.send}</button>
          </form>
        </Card>

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
                    <p className="truncate text-xs text-slate-400">{m.email}</p>
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
          {members.length > 0 && <p className="mt-2 text-xs text-slate-400">{t.sh.disconnectHint}</p>}

          <p className="mt-4 mb-2 text-xs font-medium text-slate-500">{t.sh.orLink}</p>
          <form action={createCalendarInvite}>
            <input type="hidden" name="role" value="editor" />
            <button className={`${btnGhostCls} w-full`}>＋ {t.sh.inviteEditor}</button>
          </form>
        </Card>

        {invites.length > 0 && (
          <Card>
            <h2 className="mb-2 font-semibold">{t.sh.pending}</h2>
            <ul className="divide-y divide-slate-100 text-sm">
              {invites.map((inv) => {
                const invitee = invitees.find((u) => u.id === inv.inviteeUserId);
                return (
                  <li key={inv.id} className="py-2">
                    <div className="flex items-center justify-between gap-2">
                      <div className="min-w-0">
                        <p className="truncate font-medium">
                          {invitee ? `⏳ ${invitee.name}` : "🔗"}
                        </p>
                        {inv.expiresAt && (
                          <p className="text-xs text-slate-400">{t.sh.validUntil(formatDate(inv.expiresAt.toISOString().slice(0, 10), intl))}</p>
                        )}
                      </div>
                      <div className="flex shrink-0 items-center gap-1">
                        {!invitee && (
                          <ShareLink path={`/join/${inv.token}`} label={t.pt.invite} copiedLabel={t.pt.copied} title={t.sh.title} />
                        )}
                        <form action={revokeCalendarInvite}>
                          <input type="hidden" name="id" value={inv.id} />
                          <button aria-label={t.sh.revoke} className="p-1 text-slate-300 active:text-rose-600">
                            <XIcon />
                          </button>
                        </form>
                      </div>
                    </div>
                    {!invitee && (
                      <div className="mt-2">
                        <QrCode path={`/join/${inv.token}`} label={t.sh.qr} hint={t.sh.qrHint} />
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
          </Card>
        )}

        {sharedOnly.length > 0 && (
          <Card>
            <h2 className="mb-2 font-semibold">{t.sh.sharedWithMe}</h2>
            <ul className="divide-y divide-slate-100 text-sm">
              {sharedOnly.map((c) => {
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
