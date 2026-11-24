"use client";

import { useState } from "react";
import { enqueueEvent, type OfflineKind } from "@/lib/client/offlineQueue";

/**
 * Форма, которая работает без интернета: вместо отправки сохраняет данные на телефоне,
 * а OfflineSync отправит их, когда появится связь. quiet — без плашки (для маленьких кнопок).
 */
export default function OfflineForm({
  action,
  className,
  savedText = "",
  kind = "event",
  label,
  quiet = false,
  children,
}: {
  action: (fd: FormData) => Promise<void>;
  className?: string;
  savedText?: string;
  kind?: OfflineKind;
  label?: string;
  quiet?: boolean;
  children: React.ReactNode;
}) {
  const [saved, setSaved] = useState(false);
  return (
    <form
      action={action}
      className={className}
      onSubmit={(e) => {
        if (navigator.onLine) return;
        e.preventDefault();
        enqueueEvent(e.currentTarget, kind, label);
        if (quiet) return;
        e.currentTarget.reset();
        setSaved(true);
        window.scrollTo({ top: 0, behavior: "smooth" });
      }}
    >
      {saved && <p className="rounded-xl bg-amber-50 px-3 py-2 text-sm text-amber-800">⏳ {savedText}</p>}
      {children}
    </form>
  );
}
