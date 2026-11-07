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
          const ic = ICONS[icon];
          const body = (
            <div className="flex items-center gap-4">
              <span
                className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl"
                style={{ background: ic.bg, color: ic.fg, boxShadow: `inset 0 0 0 1px ${ic.ring}` }}
              >
                <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                  {ic.path}
                </svg>
              </span>
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

/** Иконки пунктов «Добавить»: цвет фона/иконки задан явно, чтобы одинаково смотрелось в светлой и тёмной теме. */
const ICONS = {
  event: {
    fg: "#0ea5e9", bg: "rgba(14,165,233,.14)", ring: "rgba(14,165,233,.28)",
    path: (<><rect x="3" y="4.5" width="18" height="16" rx="3" /><path d="M8 2.5v4M16 2.5v4M3 9.5h18M12 13v5M9.5 15.5h5" /></>),
  },
  expense: {
    fg: "#f43f5e", bg: "rgba(244,63,94,.14)", ring: "rgba(244,63,94,.28)",
    path: (<><path d="M5 3h14v18l-2.5-1.5L14 21l-2-1.5L10 21l-2.5-1.5L5 21z" /><path d="M9 8h6M9 12h6M9 16h3" /></>),
  },
  income: {
    fg: "#10b981", bg: "rgba(16,185,129,.14)", ring: "rgba(16,185,129,.28)",
    path: (<><rect x="2.5" y="6" width="19" height="12" rx="2.5" /><circle cx="12" cy="12" r="2.5" /><path d="M6 9.5v5M18 9.5v5" /></>),
  },
  oneTime: {
    fg: "#f59e0b", bg: "rgba(245,158,11,.15)", ring: "rgba(245,158,11,.3)",
    path: (<><rect x="3.5" y="8" width="17" height="4" rx="1" /><path d="M5 12v8.5h14V12M12 8v12.5M12 8c-1.5-3.5-6-3.5-5-1 .6 1.4 3 1 5 1zM12 8c1.5-3.5 6-3.5 5-1-.6 1.4-3 1-5 1z" /></>),
  },
  fixed: {
    fg: "#8b5cf6", bg: "rgba(139,92,246,.14)", ring: "rgba(139,92,246,.28)",
    path: (<><path d="M17 2.5l3 3-3 3" /><path d="M4 11.5v-1a5 5 0 0 1 5-5h11M7 21.5l-3-3 3-3" /><path d="M20 12.5v1a5 5 0 0 1-5 5H4" /></>),
  },
  reminder: {
    fg: "#ec4899", bg: "rgba(236,72,153,.14)", ring: "rgba(236,72,153,.28)",
    path: (<><circle cx="12" cy="13" r="7.5" /><path d="M12 9.5V13l2.5 2M4.5 4.5l2.5-2M19.5 4.5l-2.5-2" /></>),
  },
} as const;
