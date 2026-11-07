import { ListGroup, ListRow } from "@/components/ListRow";
import PageHeader from "@/components/PageHeader";
import { getI18n } from "@/i18n/server";
import { requireUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function AddPage() {
  await requireUser();
  const { t } = await getI18n();
  const options = [
    { item: t.add.event, href: "/events/new", icon: "event" },
    { item: t.add.expense, href: "/events", icon: "expense" },
    { item: t.add.income, href: "/more/income", icon: "income" },
    { item: t.add.oneTime, href: "/more/income#one-time", icon: "oneTime" },
    { item: t.add.fixed, href: "/more/expenses", icon: "fixed" },
    { item: t.add.reminder, href: "/more/reminders", icon: "reminder" },
  ] as const;

  return (
    <>
      <PageHeader title={t.add.title} />
      <div className="px-4">
        <ListGroup>
          {options.map(({ item: [title, text], href, icon }) => (
            <li key={href}>
              <ListRow href={href} icon={ICONS[icon]} title={title} subtitle={text} />
            </li>
          ))}
        </ListGroup>
      </div>
    </>
  );
}

/** Иконки пунктов «Добавить» — эмодзи, как у событий. */
const ICONS = {
  event: "📅",
  expense: "🧾",
  income: "💵",
  oneTime: "🎁",
  fixed: "🔁",
  reminder: "⏰",
} as const;
