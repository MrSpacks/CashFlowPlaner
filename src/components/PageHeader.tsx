import { and, eq, isNull, sql } from "drizzle-orm";
import Link from "next/link";
import { db } from "@/db";
import { notifications } from "@/db/schema";
import { getSession } from "@/lib/auth";

async function unreadCount() {
  try {
    const session = await getSession();
    if (!session) return null;
    const [r] = await db
      .select({ n: sql<number>`count(*)::int` })
      .from(notifications)
      .where(and(eq(notifications.userId, session.user.id), isNull(notifications.readAt)));
    return r?.n ?? 0;
  } catch {
    return null;
  }
}

/** Заголовок экрана + колокольчик уведомлений справа. */
export default async function PageHeader({ title, subtitle }: { title: string; subtitle?: string }) {
  const n = await unreadCount();
  return (
    <header className="flex items-start justify-between gap-3 px-4 pt-6 pb-3">
      <div className="min-w-0">
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-slate-500">{subtitle}</p>}
      </div>
      {n !== null && (
        <Link href="/notifications" aria-label="notifications" className="relative mt-0.5 shrink-0 rounded-full p-2 text-slate-500 active:bg-slate-100">
          <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
            <path d="M6 8a6 6 0 1 1 12 0c0 7 3 9 3 9H3s3-2 3-9M10.3 21a1.9 1.9 0 0 0 3.4 0" />
          </svg>
          {n > 0 && (
            <span className="absolute top-0.5 right-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-rose-500 px-1 text-[10px] font-bold leading-none text-white">
              {n > 99 ? "99+" : n}
            </span>
          )}
        </Link>
      )}
    </header>
  );
}
