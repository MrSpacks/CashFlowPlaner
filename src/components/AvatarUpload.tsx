"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";

const SIZE = 100;

/** Уменьшить фото до 100×100 (обрезка по центру) прямо в браузере. */
async function shrink(file: File): Promise<Blob> {
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const i = new Image();
      i.onload = () => resolve(i);
      i.onerror = reject;
      i.src = url;
    });
    const side = Math.min(img.naturalWidth, img.naturalHeight);
    const sx = (img.naturalWidth - side) / 2;
    const sy = (img.naturalHeight - side) / 2;
    const canvas = document.createElement("canvas");
    canvas.width = SIZE;
    canvas.height = SIZE;
    const ctx = canvas.getContext("2d")!;
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(img, sx, sy, side, side, 0, 0, SIZE, SIZE);
    return await new Promise<Blob>((resolve, reject) =>
      canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("toBlob"))), "image/jpeg", 0.85),
    );
  } finally {
    URL.revokeObjectURL(url);
  }
}

export default function AvatarUpload({ hasAvatar, t }: { hasAvatar: boolean; t: { change: string; remove: string; error: string } }) {
  const input = useRef<HTMLInputElement>(null);
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(false);

  async function onFile(file: File | undefined) {
    if (!file) return;
    setBusy(true);
    setErr(false);
    try {
      const blob = await shrink(file);
      const fd = new FormData();
      fd.append("file", blob, "avatar.jpg");
      const res = await fetch("/api/avatar", { method: "POST", body: fd });
      if (!res.ok) throw new Error(String(res.status));
      router.refresh();
    } catch {
      setErr(true);
    } finally {
      setBusy(false);
      if (input.current) input.current.value = "";
    }
  }

  async function remove() {
    setBusy(true);
    await fetch("/api/avatar", { method: "DELETE" }).finally(() => setBusy(false));
    router.refresh();
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <input ref={input} type="file" accept="image/*" className="hidden" onChange={(e) => onFile(e.target.files?.[0])} />
      <button
        type="button"
        disabled={busy}
        onClick={() => input.current?.click()}
        className="rounded-xl bg-emerald-600 px-3 py-1.5 text-sm font-medium text-white disabled:opacity-50"
      >
        📷 {t.change}
      </button>
      {hasAvatar && (
        <button type="button" disabled={busy} onClick={remove} className="rounded-xl px-3 py-1.5 text-sm text-slate-500 ring-1 ring-slate-300 disabled:opacity-50">
          {t.remove}
        </button>
      )}
      {err && <span className="text-xs text-rose-600">{t.error}</span>}
    </div>
  );
}
