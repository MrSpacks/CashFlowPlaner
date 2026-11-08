import { sql } from "drizzle-orm";
import { setLanguage, setTheme, signOutAction } from "@/app/actions";
import IncomingInvites from "@/components/IncomingInvites";
import { ListGroup, ListRow } from "@/components/ListRow";
import Avatar from "@/components/Avatar";
import PageHeader from "@/components/PageHeader";
import PushToggle from "@/components/PushToggle";
import { btnGhostCls, cardCls } from "@/components/ui";
import { getDb } from "@/db";
import { LANGUAGE_NAMES, LOCALES } from "@/i18n/dictionaries";
import { getI18n, getTheme } from "@/i18n/server";
import { requireUser } from "@/lib/auth";
import { canUseDailyPlan } from "@/lib/dailyPlan";
import { getProfile } from "@/lib/finance";
import { avatarUrl, countIncomingRequests, ensureUsername } from "@/lib/people";
import Link from "next/link";
import { cookies } from "next/headers";

export const dynamic = "force-dynamic";

async function tableCount() {
  try {
    const res = await getDb().execute(
      sql`select count(*)::int as n from information_schema.tables where table_schema = 'public'`,
    );
    return (res.rows?.[0] as { n?: number } | undefined)?.n ?? 0;
  } catch {
    return null;
  }
}

export default async function MorePage() {
  const user = await requireUser();
  const { t, locale } = await getI18n();
  const chosen = (await cookies()).get("lang")?.value ?? "auto";
  const theme = await getTheme();
  const [username, profile, requests] = await Promise.all([
    ensureUsername(user.id),
    getProfile(user.id),
    countIncomingRequests(user.id),
  ]);
  const n = await tableCount();

  return (
    <>
      <PageHeader title={t.more.title} subtitle={`${t.more.signedInAs} ${user.email}`} />
      <IncomingInvites userId={user.id} t={t.sh} />

      <Link href="/profile" className={`${cardCls} mx-4 mb-4 flex items-center gap-3 p-4 active:bg-slate-50`}>
        <Avatar name={user.name} src={avatarUrl(user.id, profile.avatarUpdatedAt)} seed={user.id} size={52} />
        <div className="min-w-0 flex-1">
          <p className="truncate font-semibold">{user.name}</p>
          <p className="truncate text-sm text-slate-500">@{username}</p>
        </div>
        <span className="text-sm text-emerald-700">{t.pr.title} →</span>
      </Link>

      <div className="mx-4 mb-4">
        <ListGroup>
          {canUseDailyPlan(user.id) && <li><ListRow href="/plan" icon="📋" title={t.dp.menu} /></li>}
          <li><ListRow href="/people" icon="👥" title={t.fr.title} subtitle={requests ? `${t.fr.requests}: ${requests}` : undefined} /></li>
          <li><ListRow href="/chats" icon="💬" title={t.ch.title} /></li>
          <li><ListRow href="/ideas" icon="💡" title={t.ideas.title} /></li>
          <li><ListRow href="/more/reminders" icon="⏰" title={t.prm.title} /></li>
        </ListGroup>
      </div>

      <div className="mx-4">
        <ListGroup>
          <li><ListRow href="/more/balance" icon="🏦" title={t.more.balance} /></li>
          <li><ListRow href="/more/income" icon="💵" title={t.more.incomes} /></li>
          <li><ListRow href="/more/expenses" icon="🔁" title={t.more.fixed} /></li>
          <li><ListRow href="/more/sharing" icon="🔗" title={t.sh.title} /></li>
        </ListGroup>
      </div>

      <div className={`${cardCls} mx-4 mt-4 p-4`}>
        <p className="text-sm font-medium">{t.rm.pushTitle}</p>
        <p className="mb-3 text-xs text-slate-500">{t.rm.pushHint}</p>
        <PushToggle
          t={{
            pushOn: t.rm.pushOn,
            pushOff: t.rm.pushOff,
            pushEnabled: t.rm.pushEnabled,
            pushUnsupported: t.rm.pushUnsupported,
            pushDenied: t.rm.pushDenied,
            test: t.rm.test,
          }}
        />
      </div>

      <form action={setLanguage} className={`${cardCls} mx-4 mt-4 p-4`}>
        <p className="mb-2 text-sm font-medium">{t.lang.title}</p>
        <div className="grid grid-cols-2 gap-2">
          {(["auto", ...LOCALES] as const).map((l) => {
            const active = chosen === l || (chosen === "auto" && l === "auto");
            return (
              <button
                key={l}
                name="lang"
                value={l}
                className={`rounded-xl px-3 py-2 text-sm ring-1 ${
                  active ? "bg-emerald-50 font-semibold text-emerald-700 ring-emerald-300" : "ring-slate-200"
                }`}
              >
                {l === "auto" ? `${t.lang.auto} (${LANGUAGE_NAMES[locale]})` : LANGUAGE_NAMES[l]}
              </button>
            );
          })}
        </div>
      </form>

      <form action={setTheme} className={`${cardCls} mx-4 mt-4 p-4`}>
        <p className="mb-2 text-sm font-medium">{t.theme.title}</p>
        <div className="grid grid-cols-3 gap-2">
          {(["system", "light", "dark"] as const).map((th) => (
            <button
              key={th}
              name="theme"
              value={th}
              className={`rounded-xl px-2 py-2 text-sm ring-1 ${
                theme === th ? "bg-emerald-50 font-semibold text-emerald-700 ring-emerald-300" : "ring-slate-200"
              }`}
            >
              {th === "system" ? "🖥️" : th === "light" ? "☀️" : "🌙"} {t.theme[th]}
            </button>
          ))}
        </div>
      </form>

      <form action={signOutAction} className="mx-4 mt-4">
        <button className={`${btnGhostCls} w-full text-rose-600`}>{t.more.signOut}</button>
      </form>

      <p className="mx-4 mt-6 flex items-center gap-2 text-xs text-slate-500">
        <span className={`h-2 w-2 rounded-full ${n != null ? "bg-emerald-500" : "bg-rose-500"}`} />
        {t.more.db}: {n != null ? t.more.dbOk(n) : t.more.dbFail}
      </p>
    </>
  );
}
