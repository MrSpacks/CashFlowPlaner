import { desc, eq } from "drizzle-orm";
import Link from "next/link";
import { clearNotifications, markAllNotificationsRead } from "@/app/actions";
import PageHeader from "@/components/PageHeader";
import { db } from "@/db";
import { notifications } from "@/db/schema";
import { getI18n } from "@/i18n/server";
import { requireUser } from "@/lib/auth";
import { cardCls, listCls } from "@/components/ui";

export const dynamic = "force-dynamic";

export default async function NotificationsPage() {
  const user = await requireUser();
  const { t, intl } = await getI18n();
  const list = await db
    .select()
    .from(notifications)
    .where(eq(notifications.userId, user.id))
    .orderBy(desc(notifications.createdAt))
    .limit(100);
  const unread = list.some((n) => !n.readAt);
  const fmt = new Intl.DateTimeFormat(intl, { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", timeZone: "Europe/Prague" });

  return (
    <div className="lg:max-w-2xl">
      <PageHeader title={t.nav.notifications} />
      <div className="space-y-3 px-4">
        {list.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-slate-300 p-6 text-center text-sm text-slate-500">{t.rm.centerEmpty}</div>
        ) : (
          <>
            <ul className={`${listCls} ${cardCls} overflow-hidden`}>
              {list.map((n) => (
                <li key={n.id}>
                  <Link href={`/notifications/${n.id}`} className={`flex gap-3 px-4 py-3 active:bg-slate-50 ${n.readAt ? "" : "bg-emerald-50"}`}>
                    <span className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${n.readAt ? "bg-transparent" : "bg-emerald-500"}`} />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-baseline justify-between gap-2">
                        <p className={`truncate text-sm ${n.readAt ? "font-medium" : "font-semibold"}`}>{n.title}</p>
                        <span className="shrink-0 text-xs text-slate-400">{fmt.format(n.createdAt)}</span>
                      </div>
                      <p className="mt-0.5 text-sm whitespace-pre-line text-slate-600">{n.body}</p>
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
            <div className="flex gap-2">
              {unread && (
                <form action={markAllNotificationsRead} className="flex-1">
                  <button className="flex h-11 w-full items-center justify-center truncate rounded-xl px-3 text-sm font-medium text-emerald-700 ring-1 ring-slate-300">✓ {t.rm.markAll}</button>
                </form>
              )}
              <form action={clearNotifications} className="flex-1">
                <button className="flex h-11 w-full items-center justify-center truncate rounded-xl px-3 text-sm font-medium text-slate-500 ring-1 ring-slate-300">🗑 {t.rm.clearAll}</button>
              </form>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
