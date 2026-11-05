"use client";

import { useEffect, useState } from "react";

/**
 * Глобальный индикатор загрузки: следит за запросами к серверу (переходы и действия форм)
 * и показывает полоску вверху; на нажатой кнопке — крутилка и блокировка повторного нажатия.
 */
let installed = false;
let inflight = 0;
const listeners = new Set<(n: number) => void>();
const emit = () => listeners.forEach((l) => l(inflight));

function install() {
  if (installed || typeof window === "undefined") return;
  installed = true;
  const orig = window.fetch.bind(window);
  window.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
    const h = new Headers(init?.headers ?? (input instanceof Request ? input.headers : undefined));
    const tracked = h.has("next-action") || h.get("rsc") === "1";
    const prefetch = h.has("next-router-prefetch");
    if (!tracked || prefetch) return orig(input, init);
    inflight++;
    emit();
    try {
      return await orig(input, init);
    } finally {
      inflight = Math.max(0, inflight - 1);
      emit();
    }
  };
}

export default function NetworkActivity() {
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    install();
    let timer: ReturnType<typeof setTimeout> | undefined;
    const onChange = (n: number) => {
      clearTimeout(timer);
      if (n > 0) timer = setTimeout(() => setBusy(true), 120); // не мигать на быстрых запросах
      else {
        setBusy(false);
        document.querySelectorAll("[data-pending]").forEach((el) => {
          el.removeAttribute("data-pending");
          (el as HTMLButtonElement).disabled = false;
        });
      }
    };
    listeners.add(onChange);

    // Нажатая кнопка формы: крутилка + защита от двойного нажатия.
    const onSubmit = (e: SubmitEvent) => {
      if (e.defaultPrevented) return;
      const btn = (e.submitter ?? (e.target as HTMLFormElement).querySelector("button:not([type=button])")) as HTMLButtonElement | null;
      if (!btn) return;
      setTimeout(() => {
        btn.setAttribute("data-pending", "");
        btn.disabled = true;
        // на случай, если запрос так и не ушёл (ошибка проверки формы и т.п.)
        setTimeout(() => {
          if (inflight === 0 && btn.hasAttribute("data-pending")) {
            btn.removeAttribute("data-pending");
            btn.disabled = false;
          }
        }, 8000);
      }, 0);
    };
    document.addEventListener("submit", onSubmit);
    return () => {
      listeners.delete(onChange);
      document.removeEventListener("submit", onSubmit);
      clearTimeout(timer);
    };
  }, []);

  return (
    <div
      aria-hidden
      className={`pointer-events-none fixed inset-x-0 top-0 z-[60] h-0.5 overflow-hidden transition-opacity duration-200 ${busy ? "opacity-100" : "opacity-0"}`}
      style={{ top: "env(safe-area-inset-top)" }}
    >
      <div className="cfp-progress h-full w-1/3 bg-emerald-500" />
    </div>
  );
}
