import Link from "next/link";
import Avatar from "@/components/Avatar";
import type { UserInfo } from "@/lib/people";

/** Строка человека: аватарка, имя, @ник и кнопки справа. */
export default function PersonRow({ u, children, href }: { u: UserInfo; children?: React.ReactNode; href?: string }) {
  const body = (
    <>
      <Avatar name={u.name} src={u.avatar} seed={u.id} size={40} />
      <div className="min-w-0 flex-1">
        <p className="truncate font-medium">{u.name}</p>
        {u.username && <p className="truncate text-xs text-slate-400">@{u.username}</p>}
      </div>
    </>
  );
  return (
    <li className="flex items-center gap-3 py-2.5">
      {href ? (
        <Link href={href} className="flex min-w-0 flex-1 items-center gap-3">
          {body}
        </Link>
      ) : (
        <div className="flex min-w-0 flex-1 items-center gap-3">{body}</div>
      )}
      {children && <div className="flex shrink-0 items-center gap-1.5">{children}</div>}
    </li>
  );
}
