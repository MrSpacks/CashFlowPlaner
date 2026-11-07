import Link from "next/link";
import { cardCls, listCls } from "@/components/ui";

/**
 * Общая строка списка: иконка-эмодзи в квадрате, заголовок, подпись в одну строку, справа — что угодно.
 * Используется в списке событий и в «Добавить», чтобы всё выглядело одинаково.
 */
export function ListRow({
  href,
  icon,
  title,
  subtitle,
  right,
}: {
  href: string;
  icon: React.ReactNode;
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  right?: React.ReactNode;
}) {
  return (
    <Link href={href} className="flex items-center gap-3 px-3 py-3 active:bg-slate-50">
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-slate-50 text-xl">{icon}</span>
      <div className="min-w-0 flex-1">
        <p className="truncate font-medium">{title}</p>
        {subtitle != null && <p className="truncate text-xs text-slate-500">{subtitle}</p>}
      </div>
      {right ?? (
        <svg viewBox="0 0 24 24" className="h-5 w-5 shrink-0 text-slate-300" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round">
          <path d="M9 6l6 6-6 6" />
        </svg>
      )}
    </Link>
  );
}

/** Карточка-группа строк с разделителями. */
export function ListGroup({ children }: { children: React.ReactNode }) {
  return <ul className={`${listCls} overflow-hidden ${cardCls}`}>{children}</ul>;
}
