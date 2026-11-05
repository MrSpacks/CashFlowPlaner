"use client";

import { useState } from "react";
import { enqueueEvent } from "@/lib/client/offlineQueue";

/** Форма создания события: без интернета сохраняет событие на телефоне вместо отправки. */
export default function OfflineForm({
  action,
  className,
  savedText,
  children,
}: {
  action: (fd: FormData) => Promise<void>;
  className?: string;
  savedText: string;
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
        enqueueEvent(e.currentTarget);
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
