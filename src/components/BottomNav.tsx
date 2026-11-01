"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const items = [
  { href: "/", label: "Прогноз", icon: "M4 19V9m6 10V5m6 14v-7m4 7H2" },
  { href: "/calendar", label: "Календарь", icon: "M7 3v3m10-3v3M4 9h16M5 5h14a1 1 0 0 1 1 1v13a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1Z" },
  { href: "/add", label: "Добавить", icon: "M12 5v14M5 12h14", primary: true },
  { href: "/ideas", label: "Идеи", icon: "M9 18h6m-5 3h4M12 3a6 6 0 0 0-3.5 10.9c.6.4 1 1.1 1 1.8V16h5v-.3c0-.7.4-1.4 1-1.8A6 6 0 0 0 12 3Z" },
  { href: "/more", label: "Ещё", icon: "M5 12h.01M12 12h.01M19 12h.01" },
];

export default function BottomNav() {
  const pathname = usePathname();

  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-20 border-t border-slate-200 bg-white/95 backdrop-blur"
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
    >
      <ul className="mx-auto flex max-w-xl items-end justify-around px-2 pt-1.5 pb-1">
        {items.map((it) => {
          const active = it.href === "/" ? pathname === "/" : pathname.startsWith(it.href);
          return (
            <li key={it.href}>
              <Link
                href={it.href}
                className={`flex flex-col items-center gap-0.5 px-2 text-[11px] font-medium ${
                  active ? "text-emerald-600" : "text-slate-500"
                }`}
              >
                <span
                  className={
                    it.primary
                      ? "-mt-5 flex h-12 w-12 items-center justify-center rounded-full bg-emerald-600 text-white shadow-lg shadow-emerald-600/30"
                      : "flex h-7 w-7 items-center justify-center"
                  }
                >
                  <svg
                    viewBox="0 0 24 24"
                    className={it.primary ? "h-6 w-6" : "h-6 w-6"}
                    fill="none"
                    stroke="currentColor"
                    strokeWidth={it.href === "/more" ? 3 : 1.8}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d={it.icon} />
                  </svg>
                </span>
                {it.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
