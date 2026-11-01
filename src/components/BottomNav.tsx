"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

type Labels = { forecast: string; calendar: string; add: string; ideas: string; more: string };

const ICONS = {
  forecast: "M4 19V9m6 10V5m6 14v-7m4 7H2",
  calendar: "M7 3v3m10-3v3M4 9h16M5 5h14a1 1 0 0 1 1 1v13a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1Z",
  add: "M12 5v14M5 12h14",
  ideas: "M9 18h6m-5 3h4M12 3a6 6 0 0 0-3.5 10.9c.6.4 1 1.1 1 1.8V16h5v-.3c0-.7.4-1.4 1-1.8A6 6 0 0 0 12 3Z",
  more: "M5 12h.01M12 12h.01M19 12h.01",
};

const HIDDEN_ON = ["/login", "/register"];

export default function BottomNav({ labels }: { labels: Labels }) {
  const pathname = usePathname();
  if (HIDDEN_ON.some((p) => pathname.startsWith(p))) return null;

  const items = [
    { key: "forecast", href: "/" },
    { key: "calendar", href: "/calendar" },
    { key: "add", href: "/add" },
    { key: "ideas", href: "/ideas" },
    { key: "more", href: "/more" },
  ] as const;

  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-20 border-t border-slate-200 bg-white/95 backdrop-blur"
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
    >
      {/* 5 равных колонок — «＋» всегда ровно по центру экрана */}
      <ul className="mx-auto grid max-w-xl grid-cols-5 items-end pt-1.5 pb-1">
        {items.map((it) => {
          const active = it.href === "/" ? pathname === "/" : pathname.startsWith(it.href);
          const primary = it.key === "add";
          return (
            <li key={it.key} className="flex justify-center">
              <Link
                href={it.href}
                className={`flex min-w-0 flex-col items-center gap-0.5 text-[11px] font-medium ${
                  active ? "text-emerald-600" : "text-slate-500"
                }`}
              >
                <span
                  className={
                    primary
                      ? "-mt-5 flex h-12 w-12 items-center justify-center rounded-full bg-emerald-600 text-white shadow-lg shadow-emerald-600/30"
                      : "flex h-7 w-7 items-center justify-center"
                  }
                >
                  <svg
                    viewBox="0 0 24 24"
                    className="h-6 w-6"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth={it.key === "more" ? 3 : 1.8}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d={ICONS[it.key]} />
                  </svg>
                </span>
                <span className="max-w-full truncate">{labels[it.key]}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
