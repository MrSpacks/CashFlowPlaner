"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { syncOfflineEvent } from "@/app/actions";
import { QUEUE_EVENT, readQueue, removeFromQueue, type QueuedEvent } from "@/lib/client/offlineQueue";

type T = { offline: string; queued: string; synced: string; syncing: string };

/** Плашка «нет интернета», очередь отложенных событий и их отправка при появлении связи. */
export default function OfflineSync({ t }: { t: T }) {
  const router = useRouter();
  const [online, setOnline] = useState(true);
  const [queue, setQueue] = useState<QueuedEvent[]>([]);
  const [syncing, setSyncing] = useState(false);
  const [done, setDone] = useState(0);
  const busy = useRef(false);

  const sync = useCallback(async () => {
    if (busy.current || !navigator.onLine) return;
    const items = readQueue();
    if (items.length === 0) return;
    busy.current = true;
    setSyncing(true);
    let sent = 0;
    for (const it of items) {
      try {
        const id = await syncOfflineEvent(it.entries);
        // null — пустое название: такое событие отправлять бессмысленно, тоже убираем
        removeFromQueue(it.id);
        if (id) sent++;
      } catch {
        break; // связь пропала — попробуем позже
      }
    }
    busy.current = false;
    setSyncing(false);
    if (sent) {
      setDone(sent);
      setTimeout(() => setDone(0), 4000);
      router.refresh();
    }
  }, [router]);

  useEffect(() => {
    const refresh = () => setQueue(readQueue());
    const on = () => {
      setOnline(true);
      void sync();
    };
    const off = () => setOnline(false);
    setOnline(navigator.onLine);
    refresh();
    void sync();
    window.addEventListener("online", on);
    window.addEventListener("offline", off);
    window.addEventListener(QUEUE_EVENT, refresh);
    window.addEventListener("storage", refresh);
    const timer = setInterval(() => void sync(), 30000);
    return () => {
      window.removeEventListener("online", on);
      window.removeEventListener("offline", off);
      window.removeEventListener(QUEUE_EVENT, refresh);
      window.removeEventListener("storage", refresh);
      clearInterval(timer);
    };
  }, [sync]);

  if (online && queue.length === 0 && !done) return null;

  return (
    <div className="sticky top-0 z-40 space-y-1 px-3 pt-2" style={{ paddingTop: "calc(0.5rem + env(safe-area-inset-top))" }}>
      {!online && <p className="rounded-xl bg-amber-50 px-3 py-2 text-xs text-amber-800 ring-1 ring-amber-200">📴 {t.offline}</p>}
      {queue.length > 0 && (
        <div className="rounded-xl bg-white px-3 py-2 text-xs text-slate-700 shadow-sm ring-1 ring-slate-200">
          <p className="font-semibold">
            ⏳ {t.queued.replace("{n}", String(queue.length))}
            {syncing && <span className="ml-2 font-normal text-slate-500">{t.syncing}</span>}
          </p>
          <p className="truncate text-slate-500">{queue.map((q) => q.title).join(" · ")}</p>
        </div>
      )}
      {done > 0 && (
        <p className="rounded-xl bg-emerald-50 px-3 py-2 text-xs text-emerald-800 ring-1 ring-emerald-200">✓ {t.synced.replace("{n}", String(done))}</p>
      )}
    </div>
  );
}
