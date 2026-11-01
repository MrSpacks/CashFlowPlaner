import { sql } from "drizzle-orm";
import { setLanguage, signOutAction } from "@/app/actions";
import PageHeader from "@/components/PageHeader";
import PushToggle from "@/components/PushToggle";
import { RowLink, btnGhostCls } from "@/components/ui";
import { getDb } from "@/db";
import { LANGUAGE_NAMES, LOCALES } from "@/i18n/dictionaries";
import { getI18n } from "@/i18n/server";
import { requireUser } from "@/lib/auth";
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
  const n = await tableCount();

  return (
    <>
      <PageHeader title={t.more.title} subtitle={`${t.more.signedInAs} ${user.email}`} />

      <div className="mx-4 divide-y divide-slate-100 overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-slate-200">
        <RowLink href="/more/balance" label={t.more.balance} />
        <RowLink href="/more/income" label={t.more.incomes} />
        <RowLink href="/more/expenses" label={t.more.fixed} />
        <RowLink href="/more/sharing" label={t.sh.title} />
      </div>

      <div className="mx-4 mt-4 rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-200">
        <p className="text-sm font-medium">{t.rm.pushTitle}</p>
        <p className="mb-3 text-xs text-slate-500">{t.rm.pushHint}</p>
        <PushToggle t={t.rm} />
      </div>

      <form action={setLanguage} className="mx-4 mt-4 rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-200">
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
