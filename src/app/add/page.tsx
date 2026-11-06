import Link from "next/link";
import PageHeader from "@/components/PageHeader";
import { getI18n } from "@/i18n/server";
import { requireUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function AddPage() {
  await requireUser();
  const { t } = await getI18n();
  const options = [
    { item: t.add.event, href: "/events/new" },
    { item: t.add.expense, href: "/events" },
    { item: t.add.income, href: "/more/income" },
    { item: t.add.oneTime, href: "/more/income#one-time" },
    { item: t.add.fixed, href: "/more/expenses" },
  ];

  return (
    <>
      <PageHeader title={t.add.title} />
      <ul className="space-y-2 px-4">
        {options.map(({ item: [title, text], href }) => {
          const body = (
            <>
              <div className="flex items-center justify-between">
                <span className="font-medium">{title}</span>
                {!href && <span className="text-xs text-slate-400">{t.common.soon}</span>}
              </div>
              <p className="mt-0.5 text-sm text-slate-500">{text}</p>
            </>
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
