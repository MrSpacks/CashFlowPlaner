"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

type Labels = { forecast: string; calendar: string; add: string; ideas: string; more: string; chats: string; people: string; notifications: string };
type Me = { name: string; avatar: string | null; id: string } | null;

const ICONS = {
  forecast: "M4 19V9m6 10V5m6 14v-7m4 7H2",
  calendar: "M7 3v3m10-3v3M4 9h16M5 5h14a1 1 0 0 1 1 1v13a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1Z",
  add: "M12 5v14M5 12h14",
  ideas: "M9 18h6m-5 3h4M12 3a6 6 0 0 0-3.5 10.9c.6.4 1 1.1 1 1.8V16h5v-.3c0-.7.4-1.4 1-1.8A6 6 0 0 0 12 3Z",
  more: "M5 12h.01M12 12h.01M19 12h.01",
  chats: "M4 5h16v11H8l-4 4V5Z",
  people: "M16 19v-1a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v1M9 10a3 3 0 1 0 0-6 3 3 0 0 0 0 6Zm13 9v-1a4 4 0 0 0-3-3.9M16 4.1a3 3 0 0 1 0 5.8",
  notifications: "M6 8a6 6 0 1 1 12 0c0 7 3 9 3 9H3s3-2 3-9M10.3 21a1.9 1.9 0 0 0 3.4 0",
};

// Телефон: 5 кнопок. Компьютер: все разделы.
const ITEMS = [
  { key: "forecast", href: "/" },
  { key: "calendar", href: "/calendar" },
  { key: "add", href: "/add" },
  { key: "chats", href: "/chats" },
  { key: "more", href: "/more" },
] as const;
const SIDE = [
  { key: "forecast", href: "/" },
  { key: "calendar", href: "/calendar" },
  { key: "ideas", href: "/ideas" },
  { key: "chats", href: "/chats" },
  { key: "people", href: "/people" },
  { key: "notifications", href: "/notifications" },
  { key: "more", href: "/more" },
] as const;

const HIDDEN_ON = ["/login", "/register", "/invite", "/join"];

const isActive = (pathname: string, href: string) => (href === "/" ? pathname === "/" : pathname.startsWith(href));

function Icon({ k, className = "h-6 w-6" }: { k: keyof typeof ICONS; className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={className}
      fill="none"
      stroke="currentColor"
      strokeWidth={k === "more" ? 3 : 1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d={ICONS[k]} />
    </svg>
  );
}

/** Телефон: нижнее меню. Компьютер (≥1024px): боковое меню слева. */
function Badge({ n, className = "" }: { n: number; className?: string }) {
  if (!n) return null;
  return (
    <span className={`flex h-4 min-w-4 items-center justify-center rounded-full bg-rose-500 px-1 text-[10px] font-bold leading-none text-white ${className}`}>
      {n > 99 ? "99+" : n}
    </span>
  );
}

export default function BottomNav({
  labels,
  badges = { chats: 0, people: 0, notifications: 0 },
  me = null,
}: {
  labels: Labels;
  badges?: { chats: number; people: number; notifications: number };
  me?: Me;
}) {
  const pathname = usePathname();
  if (HIDDEN_ON.some((p) => pathname.startsWith(p))) return null;
  // Внутри переписки — как в мессенджерах: без нижнего меню, поле ввода у самого низа.
  const inChat = /^\/chats\/[0-9a-f-]{36}$/i.test(pathname);

  return (
    <>
      {/* боковое меню */}
      <aside
        id="sidenav"
        className="fixed inset-y-0 left-0 z-20 hidden w-60 flex-col border-r border-slate-200 bg-white px-3 py-5 lg:flex"
      >
        <Link href="/" className="mb-6 flex items-center gap-2 px-2">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/icons/icon-192.png" alt="" className="h-8 w-8 rounded-lg" />
          <span className="text-lg font-bold text-slate-900">CashFlowPlaner</span>
        </Link>
        <Link
          href="/add"
          className="mb-4 flex items-center justify-center gap-2 rounded-xl bg-emerald-600 px-3 py-2.5 text-sm font-semibold text-white shadow-sm active:bg-emerald-700"
        >
          <Icon k="add" className="h-5 w-5" />
          {labels.add}
        </Link>
        <nav className="space-y-1">
          {SIDE.map((it) => {
            const active = isActive(pathname, it.href);
            const n =
              it.key === "chats" ? badges.chats : it.key === "people" ? badges.people : it.key === "notifications" ? badges.notifications : 0;
            return (
              <Link
                key={it.key}
                href={it.href}
                className={`flex items-center gap-3 rounded-xl px-3 py-2 text-sm font-medium ${
                  active ? "bg-emerald-50 text-emerald-700" : "text-slate-600 active:bg-slate-100"
                }`}
              >
                <Icon k={it.key} className="h-5 w-5" />
                <span className="flex-1">{labels[it.key]}</span>
                <Badge n={n} />
              </Link>
            );
          })}
        </nav>
        {me && (
          <Link href="/profile" className="mt-auto flex items-center gap-2 rounded-xl px-2 py-2 active:bg-slate-100">
            {me.avatar ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={me.avatar} alt="" className="h-8 w-8 rounded-full object-cover" />
            ) : (
              <span className="flex h-8 w-8 items-center justify-center rounded-full bg-emerald-600 text-sm font-semibold text-white">
                {me.name.slice(0, 1).toUpperCase()}
              </span>
            )}
            <span className="truncate text-sm font-medium text-slate-700">{me.name}</span>
          </Link>
        )}
      </aside>

      {/* нижнее меню */}
      <nav
        className={`fixed inset-x-0 bottom-0 z-20 border-t border-slate-200 bg-white/95 backdrop-blur lg:hidden ${inChat ? "hidden" : ""}`}
        style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
      >
        {/* 5 равных колонок — «＋» всегда ровно по центру экрана */}
        <ul className="mx-auto grid max-w-xl grid-cols-5 items-end pt-1.5 pb-1">
          {ITEMS.map((it) => {
            const active = isActive(pathname, it.href);
            const primary = it.key === "add";
            return (
              <li key={it.key} className="flex justify-center">
                <Link
                  href={it.href}
                  className={`relative flex min-w-0 flex-col items-center gap-0.5 text-[11px] font-medium ${
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
                    <Icon k={it.key} />
                  </span>
                  {(it.key === "chats" || it.key === "more") && (
                    <Badge n={it.key === "chats" ? badges.chats : badges.people} className="absolute top-0 left-1/2 ml-2" />
                  )}
                  <span className="max-w-full truncate">{labels[it.key]}</span>
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
    </>
  );
}
