"use client";

import { useState } from "react";

/** Поделиться ссылкой: системное меню «Поделиться» на телефоне, иначе — копирование. */
export default function ShareLink({ path, label, copiedLabel, title }: { path: string; label: string; copiedLabel: string; title: string }) {
  const [copied, setCopied] = useState(false);

  async function share() {
    const url = `${window.location.origin}${path}`;
    try {
      if (navigator.share) {
        await navigator.share({ title, url });
        return;
      }
    } catch {
      // пользователь закрыл меню — пробуем скопировать
    }
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      window.prompt("", url);
    }
  }

  return (
    <button type="button" onClick={share} className="rounded-lg bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-700 active:bg-emerald-100">
      {copied ? copiedLabel : label}
    </button>
  );
}
