import { and, eq, ilike, inArray, or } from "drizzle-orm";
import { ListGroup, ListRow } from "@/components/ListRow";
import PageHeader from "@/components/PageHeader";
import { inputCls } from "@/components/ui";
import { db } from "@/db";
import { expenseItems, spendings } from "@/db/schema";
import { getI18n } from "@/i18n/server";
import { requireUser } from "@/lib/auth";
import { CATEGORIES, CATEGORY_ICON, isCategory } from "@/lib/categories";
import { listUserEvents, TYPE_ICON } from "@/lib/events";
import { formatDate, formatMoney } from "@/lib/forecast";

export const dynamic = "force-dynamic";

const norm = (s: string) => s.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase();

/** Поиск по событиям (и идеям), расходам в событиях и тратам. Без диакритики: «detenice» найдёт «Dětěnice». */
export default async function SearchPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const user = await requireUser();
  const { t, intl } = await getI18n();
  const q = ((await searchParams).q ?? "").trim().slice(0, 60);
  const nq = norm(q);

  let evs: Awaited<ReturnType<typeof listUserEvents>> = [];
  let items: { id: string; eventId: string; title: string; amount: string; currency: string }[] = [];
  let spent: { id: string; date: string; amount: string; currency: string; category: string; note: string | null }[] = [];
  if (q.length >= 2) {
    const all = await listUserEvents(user.id);
    evs = all.filter((e) => norm(`${e.title} ${e.notes ?? ""}`).includes(nq)).slice(0, 30);
    const ids = all.map((e) => e.id);
    const like = `%${q}%`;
    const catHits = CATEGORIES.filter((c) => norm(t.cat[c]).includes(nq));
    [items, spent] = await Promise.all([
      ids.length
        ? db
            .select({ id: expenseItems.id, eventId: expenseItems.eventId, title: expenseItems.title, amount: expenseItems.amount, currency: expenseItems.currency })
            .from(expenseItems)
            .where(and(inArray(expenseItems.eventId, ids), ilike(expenseItems.title, like)))
            .limit(30)
        : Promise.resolve([]),
      db
        .select({ id: spendings.id, date: spendings.date, amount: spendings.amount, currency: spendings.currency, category: spendings.category, note: spendings.note })
        .from(spendings)
        .where(
          and(
            eq(spendings.ownerId, user.id),
            catHits.length ? or(ilike(spendings.note, like), inArray(spendings.category, catHits)) : ilike(spendings.note, like),
          ),
        )
        .limit(30),
    ]);
    // Диакритика: добираем расходы, где совпало без неё (ilike её не игнорирует).
    items = items.length ? items : [];
    const evTitle = new Map(all.map((e) => [e.id, e.title]));
    items = items.map((i) => ({ ...i, title: `${i.title} · ${evTitle.get(i.eventId) ?? ""}` }));
  }
  const nothing = q.length >= 2 && evs.length + items.length + spent.length === 0;

  return (
    <>
      <PageHeader title={`🔍 ${t.srch.title}`} />
      <div className="space-y-4 px-4">
        <form action="/search">
          <input name="q" type="search" defaultValue={q} autoFocus placeholder={t.srch.placeholder} className={`${inputCls} text-base`} />
        </form>
        {q.length > 0 && q.length < 2 && <p className="text-sm text-slate-500">{t.srch.min}</p>}
        {nothing && <p className="text-sm text-slate-500">{t.srch.none}</p>}

        {evs.length > 0 && (
          <section>
            <h2 className="mb-2 text-sm font-semibold text-slate-500">{t.srch.events}</h2>
            <ListGroup>
              {evs.map((e) => (
                <li key={e.id}>
                  <ListRow href={`/events/${e.id}`} icon={TYPE_ICON[e.type]} title={e.title} subtitle={e.startDate ? formatDate(e.startDate, intl) : t.ev.noDate} />
                </li>
              ))}
            </ListGroup>
          </section>
        )}
        {items.length > 0 && (
          <section>
            <h2 className="mb-2 text-sm font-semibold text-slate-500">{t.srch.expenses}</h2>
            <ListGroup>
              {items.map((i) => (
                <li key={i.id}>
                  <ListRow
                    href={`/events/${i.eventId}`}
                    icon="🧾"
                    title={i.title}
                    right={<span className="shrink-0 tabular-nums">{formatMoney(Number(i.amount), i.currency, intl)}</span>}
                  />
                </li>
              ))}
            </ListGroup>
          </section>
        )}
        {spent.length > 0 && (
          <section>
            <h2 className="mb-2 text-sm font-semibold text-slate-500">{t.sp.title}</h2>
            <ListGroup>
              {spent.map((x) => (
                <li key={x.id}>
                  <ListRow
                    href={`/spend/${x.id}`}
                    icon={isCategory(x.category) ? CATEGORY_ICON[x.category] : "✨"}
                    title={x.note || (isCategory(x.category) ? t.cat[x.category] : x.category)}
                    subtitle={formatDate(x.date, intl)}
                    right={<span className="shrink-0 tabular-nums">{formatMoney(Number(x.amount), x.currency, intl)}</span>}
                  />
                </li>
              ))}
            </ListGroup>
          </section>
        )}
      </div>
    </>
  );
}
