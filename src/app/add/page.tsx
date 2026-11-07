import Link from "next/link";
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
      <ul className="space-y-2 px-4">
        {options.map(({ item: [title, text], href, icon }) => {
          const body = (
            <div className="flex items-center gap-4">
              <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-slate-50 text-2xl">{ICONS[icon]}</span>
              <div className="min-w-0 flex-1">
                <span className="font-medium">{title}</span>
                <p className="mt-0.5 text-sm text-slate-500">{text}</p>
              </div>
              <svg viewBox="0 0 24 24" className="h-5 w-5 shrink-0 text-slate-300" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round">
                <path d="M9 6l6 6-6 6" />
              </svg>
            </div>
          );
          const cls = "block rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-200";
          return (
            <li key={title}>
              {href ? (
                <Link href={href} className={`${cls} active:bg-slate-50`}>{body}</Link>
              ) : (
                <div className={`${cls} opacity-60`}>{body}</div>
              )}
            </li>
          );
        })}
      </ul>
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
