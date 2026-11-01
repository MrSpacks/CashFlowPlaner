import PageHeader from "@/components/PageHeader";
import { getDb } from "@/db";
import { sql } from "drizzle-orm";

export const dynamic = "force-dynamic";

async function dbStatus() {
  try {
    const db = getDb();
    const rows = await db.execute(
      sql`select count(*)::int as n from information_schema.tables where table_schema = 'public'`,
    );
    const n = (rows.rows?.[0] as { n?: number } | undefined)?.n ?? 0;
    return { ok: true, text: `подключена, таблиц: ${n}` };
  } catch {
    return { ok: false, text: "нет подключения" };
  }
}

const sections = ["Постоянные расходы", "Стартовый баланс", "Доходы", "Валюта", "Приглашения", "Профиль"];

export default async function MorePage() {
  const status = await dbStatus();

  return (
    <>
      <PageHeader title="Ещё" />
      <ul className="mx-4 divide-y divide-slate-100 overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-slate-200">
        {sections.map((s) => (
          <li key={s} className="flex items-center justify-between px-4 py-3 text-sm">
            <span>{s}</span>
            <span className="text-xs text-slate-400">скоро</span>
          </li>
        ))}
      </ul>
      <p className="mx-4 mt-6 flex items-center gap-2 text-xs text-slate-500">
        <span className={`h-2 w-2 rounded-full ${status.ok ? "bg-emerald-500" : "bg-rose-500"}`} />
        База данных: {status.text}
      </p>
    </>
  );
}
