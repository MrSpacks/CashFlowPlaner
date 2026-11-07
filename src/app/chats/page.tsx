import Link from "next/link";
import Avatar from "@/components/Avatar";
import PageHeader from "@/components/PageHeader";
import { getI18n } from "@/i18n/server";
import { requireUser } from "@/lib/auth";
import { listConversations } from "@/lib/chat";
import { TYPE_ICON } from "@/lib/events";
import { getUsersInfo } from "@/lib/people";
import { cardCls, listCls } from "@/components/ui";

export const dynamic = "force-dynamic";

export default async function ChatsPage() {
  const user = await requireUser();
  const { t, intl } = await getI18n();
  const list = await listConversations(user.id);
  const users = await getUsersInfo(list.flatMap((c) => [c.other ?? "", c.last?.userId ?? ""]));

  return (
    <div className="lg:max-w-2xl">
      <PageHeader title={t.ch.title} />
      <div className="px-4">
        {list.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-slate-300 p-6 text-center text-sm text-slate-500">
            {t.ch.noChats}
            <Link href="/people" className="mt-3 block font-medium text-emerald-700">
              {t.fr.title} →
            </Link>
          </div>
        ) : (
          <ul className={`${listCls} ${cardCls} overflow-hidden`}>
            {list.map((c) => {
              const other = c.other ? users.get(c.other) : null;
              const author = c.last ? users.get(c.last.userId) : null;
              const title = c.event?.title ?? other?.name ?? "—";
              const preview = c.last
                ? `${c.last.userId === user.id ? `${t.ch.you}: ` : c.event && author ? `${author.name}: ` : ""}${c.last.body}`
                : "";
              const when = c.last
                ? new Intl.DateTimeFormat(intl, { day: "numeric", month: "short" }).format(new Date(c.last.createdAt))
                : "";
              return (
                <li key={c.id}>
                  <Link href={`/chats/${c.id}`} className="flex items-center gap-3 px-3 py-3 active:bg-slate-50">
                    {c.event ? (
                      <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-slate-100 text-xl">
                        {TYPE_ICON[c.event.type]}
                      </span>
                    ) : (
                      <Avatar name={other?.name ?? "?"} src={other?.avatar} seed={c.other ?? c.id} size={44} />
                    )}
                    <div className="min-w-0 flex-1">
                      <div className="flex items-baseline justify-between gap-2">
                        <p className={`truncate ${c.unread ? "font-bold" : "font-medium"}`}>{title}</p>
                        <span className="shrink-0 text-xs text-slate-400">{when}</span>
                      </div>
                      <div className="flex items-center justify-between gap-2">
                        <p className={`truncate text-sm ${c.unread ? "text-slate-800" : "text-slate-500"}`}>{preview}</p>
                        {c.unread > 0 && (
                          <span className="flex h-5 min-w-5 shrink-0 items-center justify-center rounded-full bg-emerald-600 px-1.5 text-xs font-semibold text-white">
                            {c.unread}
                          </span>
                        )}
                      </div>
                    </div>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
