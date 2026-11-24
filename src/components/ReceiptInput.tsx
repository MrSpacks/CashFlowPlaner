"use client";

import { useRef, useState } from "react";

/**
 * Фото чека: снимок камерой или из галереи, уменьшается на телефоне до ~1400 px JPEG,
 * чтобы влезть в запрос. Отправляется полем name="receipt".
 */
export default function ReceiptInput({ label, existingUrl }: { label: string; existingUrl?: string | null }) {
  const real = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<string | null>(existingUrl ?? null);
  const [busy, setBusy] = useState(false);

  async function onPick(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !real.current) return;
    setBusy(true);
    try {
      const bmp = await createImageBitmap(file);
      const scale = Math.min(1, 1400 / Math.max(bmp.width, bmp.height));
      const c = document.createElement("canvas");
      c.width = Math.round(bmp.width * scale);
      c.height = Math.round(bmp.height * scale);
      c.getContext("2d")!.drawImage(bmp, 0, 0, c.width, c.height);
      const blob: Blob = await new Promise((res) => c.toBlob((b) => res(b!), "image/jpeg", 0.7));
      const dt = new DataTransfer();
      dt.items.add(new File([blob], "receipt.jpg", { type: "image/jpeg" }));
      real.current.files = dt.files;
      setPreview(URL.createObjectURL(blob));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex items-center gap-3">
      <input ref={real} type="file" name="receipt" className="hidden" />
      <label className="flex h-11 cursor-pointer items-center gap-2 rounded-xl px-3 text-sm font-medium text-slate-600 ring-1 ring-slate-300 active:bg-slate-50">
        📷 {label}
        <input type="file" accept="image/*" capture="environment" className="hidden" onChange={onPick} />
      </label>
      {busy && <span className="text-xs text-slate-400">…</span>}
      {preview && (
        <a href={preview} target="_blank" rel="noreferrer">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={preview} alt="" className="h-11 w-11 rounded-lg object-cover ring-1 ring-slate-200" />
        </a>
      )}
    </div>
  );
}
