import { and, eq, gt, isNull } from "drizzle-orm";
import { acceptCalendarInvite, declineCalendarInvite } from "@/app/actions";
import { db } from "@/db";
import { authUser, calendarInvites } from "@/db/schema";
import type { Dict } from "@/i18n/dictionaries";

/** Приглашения в чужие календари, адресованные мне (по email). */
export default async function IncomingInvites({ userId, t }: { userId: string; t: Dict["sh"] }) {
  const invites = await db
    .select({ id: calendarInvites.id, token: calendarInvites.token, role: calendarInvites.role, from: authUser.name })
    .from(calendarInvites)
    .innerJoin(authUser, eq(authUser.id, calendarInvites.createdBy))
    .where(
      and(
        eq(calendarInvites.inviteeUserId, userId),
        isNull(calendarInvites.acceptedBy),
        gt(calendarInvites.expiresAt, new Date()),
      ),
    );
  if (invites.length === 0) return null;

  return (
    <div className="mx-4 mb-4 space-y-2">
      {invites.map((inv) => (
        <div key={inv.id} className="rounded-2xl bg-emerald-50 p-4 ring-1 ring-emerald-200">
          <p className="text-xs font-medium text-emerald-700">📅 {t.incoming}</p>
          <p className="mt-0.5 font-semibold text-slate-900">{t.incomingText(inv.from)}</p>
          <p className="text-xs text-slate-500">{t.roles[inv.role]}</p>
          <div className="mt-3 flex gap-2">
            <form action={acceptCalendarInvite} className="flex-1">
              <input type="hidden" name="token" value={inv.token} />
              <button className="w-full rounded-xl bg-emerald-600 px-3 py-2 text-sm font-semibold text-white active:bg-emerald-700">
                {t.join}
              </button>
            </form>
            <form action={declineCalendarInvite} className="flex-1">
              <input type="hidden" name="id" value={inv.id} />
              <button className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-600">{t.decline}</button>
            </form>
          </div>
        </div>
      ))}
    </div>
  );
}
