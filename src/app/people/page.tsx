import Link from "next/link";
import { acceptFriendRequest, removeFriendship, sendFriendRequest } from "@/app/actions";
import PageHeader from "@/components/PageHeader";
import PersonRow from "@/components/PersonRow";
import { Card, inputCls } from "@/components/ui";
import { getI18n } from "@/i18n/server";
import { requireUser } from "@/lib/auth";
import { getRelations, getUsersInfo, searchUsers, suggestions } from "@/lib/people";

export const dynamic = "force-dynamic";

const small = "rounded-lg px-2.5 py-1 text-xs font-medium";

export default async function PeoplePage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const user = await requireUser();
  const { t } = await getI18n();
  const { q = "" } = await searchParams;
  const rel = await getRelations(user.id);
  const known = new Set([...rel.friends, ...rel.incoming, ...rel.outgoing].map((r) => r.userId));
  const [found, sugg] = await Promise.all([q ? searchUsers(user.id, q) : Promise.resolve([]), suggestions(user.id, known)]);
  const info = await getUsersInfo([...known, ...found, ...sugg]);
  const I = (id: string) => info.get(id) ?? { id, name: "—", username: null, avatar: null };

  const actionFor = (id: string) => {
    const fr = rel.friends.find((r) => r.userId === id);
    if (fr)
      return (
        <Link href={`/chats/with/${id}`} className={`${small} bg-slate-100 text-slate-700`}>
          💬 {t.fr.message}
        </Link>
      );
    const inc = rel.incoming.find((r) => r.userId === id);
    if (inc)
      return (
        <form action={acceptFriendRequest}>
          <input type="hidden" name="id" value={inc.friendshipId} />
          <button className={`${small} bg-emerald-600 text-white`}>{t.fr.accept}</button>
        </form>
      );
    if (rel.outgoing.some((r) => r.userId === id)) return <span className="text-xs text-slate-400">{t.fr.pending}</span>;
    return (
      <form action={sendFriendRequest}>
        <input type="hidden" name="userId" value={id} />
        <button className={`${small} bg-emerald-600 text-white`}>＋ {t.fr.add}</button>
      </form>
    );
  };

  return (
    <div className="lg:max-w-2xl">
      <PageHeader title={t.fr.title} />
      <div className="space-y-4 px-4">
        <form className="flex gap-2">
          <input name="q" defaultValue={q} placeholder={t.fr.searchPlaceholder} autoCapitalize="none" className={inputCls} />
          <button className="shrink-0 rounded-xl bg-emerald-600 px-4 text-white" aria-label="search">
            <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={2}>
              <circle cx="11" cy="11" r="7" />
              <path d="M20 20l-3.5-3.5" />
            </svg>
          </button>
        </form>

        {q && (
          <Card>
            {found.length === 0 ? (
              <p className="text-sm text-slate-500">{t.fr.noResults}</p>
            ) : (
              <ul className="divide-y divide-slate-100">
                {found.map((id) => (
                  <PersonRow key={id} u={I(id)} href={I(id).username ? `/u/${I(id).username}` : undefined}>
                    {actionFor(id)}
                  </PersonRow>
                ))}
              </ul>
            )}
          </Card>
        )}

        {rel.incoming.length > 0 && (
          <Card>
            <h2 className="mb-1 font-semibold">{t.fr.requests}</h2>
            <ul className="divide-y divide-slate-100">
              {rel.incoming.map((r) => (
                <PersonRow key={r.friendshipId} u={I(r.userId)}>
                  <form action={acceptFriendRequest}>
                    <input type="hidden" name="id" value={r.friendshipId} />
                    <button className={`${small} bg-emerald-600 text-white`}>{t.fr.accept}</button>
                  </form>
                  <form action={removeFriendship}>
                    <input type="hidden" name="id" value={r.friendshipId} />
                    <button className={`${small} text-slate-500 ring-1 ring-slate-300`}>{t.fr.decline}</button>
                  </form>
                </PersonRow>
              ))}
            </ul>
          </Card>
        )}

        <Card>
          <h2 className="mb-1 font-semibold">{t.fr.friends}</h2>
          {rel.friends.length === 0 ? (
            <p className="text-sm text-slate-500">{t.fr.noFriends}</p>
          ) : (
            <ul className="divide-y divide-slate-100">
              {rel.friends.map((r) => (
                <PersonRow key={r.friendshipId} u={I(r.userId)} href={I(r.userId).username ? `/u/${I(r.userId).username}` : undefined}>
                  <Link href={`/chats/with/${r.userId}`} className={`${small} bg-slate-100 text-slate-700`}>
                    💬
                  </Link>
                </PersonRow>
              ))}
            </ul>
          )}
        </Card>

        {sugg.length > 0 && (
          <Card>
            <h2 className="mb-1 font-semibold">{t.fr.suggestions}</h2>
            <ul className="divide-y divide-slate-100">
              {sugg.map((id) => (
                <PersonRow key={id} u={I(id)}>
                  {actionFor(id)}
                </PersonRow>
              ))}
            </ul>
          </Card>
        )}

        {rel.outgoing.length > 0 && (
          <Card>
            <h2 className="mb-1 font-semibold">{t.fr.sent}</h2>
            <ul className="divide-y divide-slate-100">
              {rel.outgoing.map((r) => (
                <PersonRow key={r.friendshipId} u={I(r.userId)}>
                  <form action={removeFriendship}>
                    <input type="hidden" name="id" value={r.friendshipId} />
                    <button className={`${small} text-slate-500 ring-1 ring-slate-300`}>{t.fr.cancel}</button>
                  </form>
                </PersonRow>
              ))}
            </ul>
          </Card>
        )}
      </div>
    </div>
  );
}
