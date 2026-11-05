// Очередь событий, созданных без интернета. Хранится на телефоне (localStorage).
export type QueuedEvent = { id: string; createdAt: string; title: string; entries: [string, string][] };

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

export function enqueueEvent(form: HTMLFormElement) {
  const fd = new FormData(form);
  const entries: [string, string][] = [];
  fd.forEach((v, k) => {
    if (typeof v === "string") entries.push([k, v]);
  });
  const title = String(fd.get("title") ?? "");
  write([...readQueue(), { id: crypto.randomUUID(), createdAt: new Date().toISOString(), title, entries }]);
}

export function removeFromQueue(id: string) {
  write(readQueue().filter((q) => q.id !== id));
}
