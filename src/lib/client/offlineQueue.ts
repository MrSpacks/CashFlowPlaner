// Очередь событий, созданных без интернета. Хранится на телефоне (localStorage).
/** kind: event — новое событие, spending — трата, expense — расход в событии, paid — отметка «оплачено». */
export type OfflineKind = "event" | "spending" | "expense" | "paid";
export type QueuedEvent = { id: string; createdAt: string; title: string; entries: [string, string][]; kind?: OfflineKind };

const KEY = "cfp-offline-events";
export const QUEUE_EVENT = "cfp-queue-changed";

export function readQueue(): QueuedEvent[] {
  try {
    return JSON.parse(localStorage.getItem(KEY) ?? "[]");
  } catch {
    return [];
  }
}

function write(q: QueuedEvent[]) {
  try {
    localStorage.setItem(KEY, JSON.stringify(q));
  } catch {
    // хранилище недоступно — ничего не поделать
  }
  window.dispatchEvent(new Event(QUEUE_EVENT));
}

export function enqueueEvent(form: HTMLFormElement, kind: OfflineKind = "event", label?: string) {
  const fd = new FormData(form);
  const entries: [string, string][] = [];
  fd.forEach((v, k) => {
    if (typeof v === "string") entries.push([k, v]);
  });
  const title = label ?? String(fd.get("title") ?? fd.get("note") ?? fd.get("amount") ?? "");
  write([...readQueue(), { id: crypto.randomUUID(), createdAt: new Date().toISOString(), title, entries, kind }]);
}

export function removeFromQueue(id: string) {
  write(readQueue().filter((q) => q.id !== id));
}
