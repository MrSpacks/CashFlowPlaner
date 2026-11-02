"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { sendMessage } from "@/app/actions";
import Avatar from "@/components/Avatar";

type Msg = { id: string; userId: string; body: string; createdAt: string };
type U = { id: string; name: string; username: string | null; avatar: string | null };

function time(iso: string, locale: string) {
  const d = new Date(iso);
  const sameDay = d.toDateString() === new Date().toDateString();
  return new Intl.DateTimeFormat(locale, sameDay ? { hour: "2-digit", minute: "2-digit" } : { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }).format(d);
}

/** Окно переписки: опрос новых сообщений раз в 4 секунды, отправка без перезагрузки. */
export default function ChatView({
  conversationId,
  me,
  initial,
  initialUsers,
  intl,
  t,
  showNames,
}: {
  conversationId: string;
  me: string;
  initial: Msg[];
  initialUsers: Record<string, U>;
  intl: string;
  t: { placeholder: string; send: string; empty: string };
  showNames: boolean;
}) {
  const [msgs, setMsgs] = useState<Msg[]>(initial);
  const [users, setUsers] = useState<Record<string, U>>(initialUsers);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const scroller = useRef<HTMLDivElement>(null);
  const lastAt = useRef<string | undefined>(initial.at(-1)?.createdAt);

  const add = useCallback((list: Msg[]) => {
    if (!list.length) return;
    setMsgs((prev) => {
      const seen = new Set(prev.map((m) => m.id));
      const merged = [...prev, ...list.filter((m) => !seen.has(m.id))];
      lastAt.current = merged.at(-1)?.createdAt;
      return merged;
    });
  }, []);

  useEffect(() => {
    const el = scroller.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [msgs.length]);

  useEffect(() => {
    let stop = false;
    const poll = async () => {
      if (document.visibilityState !== "visible") return;
      try {
        const q = lastAt.current ? `?after=${encodeURIComponent(lastAt.current)}` : "";
        const res = await fetch(`/api/chat/${conversationId}${q}`, { cache: "no-store" });
        if (!res.ok || stop) return;
        const data = (await res.json()) as { messages: Msg[]; users: Record<string, U> };
        if (data.messages.length) {
          setUsers((u) => ({ ...u, ...data.users }));
          add(data.messages);
        }
      } catch {
        // сеть пропала — попробуем в следующий раз
      }
    };
    const timer = setInterval(poll, 4000);
    document.addEventListener("visibilitychange", poll);
    return () => {
      stop = true;
      clearInterval(timer);
      document.removeEventListener("visibilitychange", poll);
    };
  }, [conversationId, add]);

  async function submit(e?: { preventDefault(): void }) {
    e?.preventDefault();
    const body = text.trim();
    if (!body || sending) return;
    setSending(true);
    try {
      const m = await sendMessage(conversationId, body);
      if (m) {
        add([m]);
        setText("");
      }
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div ref={scroller} className="min-h-0 flex-1 space-y-2 overflow-y-auto overscroll-contain px-4 py-3">
        {msgs.length === 0 && <p className="py-10 text-center text-sm text-slate-500">{t.empty}</p>}
        {msgs.map((m, i) => {
          const mine = m.userId === me;
          const u = users[m.userId];
          const firstOfGroup = i === 0 || msgs[i - 1].userId !== m.userId;
          return (
            <div key={m.id} className={`flex items-end gap-2 ${mine ? "justify-end" : "justify-start"}`}>
              {!mine && (
                <div className="w-8 shrink-0">
                  {firstOfGroup && <Avatar name={u?.name ?? "?"} src={u?.avatar} seed={m.userId} size={32} />}
                </div>
              )}
              <div
                className={`max-w-[78%] rounded-2xl px-3 py-2 text-sm ${
                  mine ? "rounded-br-md bg-emerald-600 text-white" : "rounded-bl-md bg-white text-slate-900 ring-1 ring-slate-200"
                }`}
              >
                {!mine && showNames && firstOfGroup && <p className="mb-0.5 text-xs font-semibold text-emerald-700">{u?.name ?? "—"}</p>}
                <p className="whitespace-pre-wrap break-words">{m.body}</p>
                <p className={`mt-0.5 text-right text-[10px] ${mine ? "text-white/70" : "text-slate-400"}`}>{time(m.createdAt, intl)}</p>
              </div>
            </div>
          );
        })}
      </div>

      <form
        onSubmit={submit}
        className="flex shrink-0 items-end gap-2 border-t border-slate-200 bg-white px-3 pt-2"
        style={{ paddingBottom: "calc(0.5rem + env(safe-area-inset-bottom))" }}
      >
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey && !("ontouchstart" in window)) {
              e.preventDefault();
              void submit(e);
            }
          }}
          rows={1}
          placeholder={t.placeholder}
          className="max-h-32 min-h-[2.5rem] flex-1 resize-none rounded-2xl border border-slate-300 bg-white px-3 py-2 text-base text-slate-900 outline-none focus:border-emerald-500"
        />
        <button
          disabled={sending || !text.trim()}
          aria-label={t.send}
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-emerald-600 text-white disabled:opacity-40"
        >
          <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={2}>
            <path d="M5 12h14M13 6l6 6-6 6" />
          </svg>
        </button>
      </form>
    </div>
  );
}
