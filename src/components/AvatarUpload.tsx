"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

const OUT = 100; // итоговый размер аватарки, px
const VIEW = 260; // размер окна обрезки на экране, px

type Img = { el: HTMLImageElement; w: number; h: number; url: string };

function loadImage(file: File): Promise<Img> {
  const url = URL.createObjectURL(file);
  return new Promise((resolve, reject) => {
    const el = new Image();
    el.onload = () => resolve({ el, w: el.naturalWidth, h: el.naturalHeight, url });
    el.onerror = reject;
    el.src = url;
  });
}

/** Окно обрезки: двигать пальцем/мышью, приближать ползунком, колёсиком или двумя пальцами. */
function Cropper({
  img,
  onCancel,
  onDone,
  t,
}: {
  img: Img;
  onCancel: () => void;
  onDone: (blob: Blob) => void;
  t: { save: string; cancel: string; zoom: string };
}) {
  const base = VIEW / Math.min(img.w, img.h); // масштаб «заполнить окно»
  const [zoom, setZoom] = useState(1);
  const [pos, setPos] = useState({ x: (VIEW - img.w * base) / 2, y: (VIEW - img.h * base) / 2 });
  const pointers = useRef(new Map<number, { x: number; y: number }>());
  const pinch = useRef<{ dist: number; zoom: number } | null>(null);

  const scale = base * zoom;
  const clamp = (p: { x: number; y: number }, s = scale) => ({
    x: Math.min(0, Math.max(VIEW - img.w * s, p.x)),
    y: Math.min(0, Math.max(VIEW - img.h * s, p.y)),
  });

  // Приближение относительно центра окна.
  const setZoomCentered = (z: number) => {
    const nz = Math.min(5, Math.max(1, z));
    const s0 = scale;
    const s1 = base * nz;
    const cx = VIEW / 2;
    const cy = VIEW / 2;
    setPos((p) => clamp({ x: cx - ((cx - p.x) / s0) * s1, y: cy - ((cy - p.y) / s0) * s1 }, s1));
    setZoom(nz);
  };

  const onPointerDown = (e: React.PointerEvent) => {
    (e.target as Element).setPointerCapture(e.pointerId);
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pointers.current.size === 2) {
      const [a, b] = [...pointers.current.values()];
      pinch.current = { dist: Math.hypot(a.x - b.x, a.y - b.y), zoom };
    }
  };
  const onPointerMove = (e: React.PointerEvent) => {
    const prev = pointers.current.get(e.pointerId);
    if (!prev) return;
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pointers.current.size === 2 && pinch.current) {
      const [a, b] = [...pointers.current.values()];
      setZoomCentered((pinch.current.zoom * Math.hypot(a.x - b.x, a.y - b.y)) / pinch.current.dist);
      return;
    }
    setPos((p) => clamp({ x: p.x + e.clientX - prev.x, y: p.y + e.clientY - prev.y }));
  };
  const onPointerUp = (e: React.PointerEvent) => {
    pointers.current.delete(e.pointerId);
    if (pointers.current.size < 2) pinch.current = null;
  };

  async function save() {
    const canvas = document.createElement("canvas");
    canvas.width = OUT;
    canvas.height = OUT;
    const ctx = canvas.getContext("2d")!;
    ctx.imageSmoothingQuality = "high";
    const side = VIEW / scale;
    ctx.drawImage(img.el, -pos.x / scale, -pos.y / scale, side, side, 0, 0, OUT, OUT);
    canvas.toBlob((b) => b && onDone(b), "image/jpeg", 0.88);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="w-full max-w-sm rounded-2xl bg-white p-4 shadow-lg">
        <div
          className="relative mx-auto touch-none overflow-hidden rounded-xl bg-slate-900 select-none"
          style={{ width: VIEW, height: VIEW, cursor: "grab" }}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
          onWheel={(e) => setZoomCentered(zoom * (e.deltaY < 0 ? 1.1 : 0.9))}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={img.url}
            alt=""
            draggable={false}
            className="pointer-events-none absolute top-0 left-0 max-w-none origin-top-left"
            style={{ width: img.w, height: img.h, transform: `translate(${pos.x}px, ${pos.y}px) scale(${scale})` }}
          />
          {/* затемнение вокруг круга */}
          <div className="pointer-events-none absolute inset-0 rounded-full" style={{ boxShadow: "0 0 0 999px rgba(0,0,0,0.5)" }} />
          <div className="pointer-events-none absolute inset-0 rounded-full ring-2 ring-white/80" />
        </div>

        <label className="mt-4 flex items-center gap-3 text-sm text-slate-600">
          <span>🔍 {t.zoom}</span>
          <input
            type="range"
            min={1}
            max={5}
            step={0.01}
            value={zoom}
            onChange={(e) => setZoomCentered(Number(e.target.value))}
            className="flex-1 accent-emerald-600"
          />
        </label>

        <div className="mt-4 flex gap-2">
          <button type="button" onClick={onCancel} className="flex-1 rounded-xl px-3 py-2.5 text-sm text-slate-600 ring-1 ring-slate-300">
            {t.cancel}
          </button>
          <button type="button" onClick={save} className="flex-1 rounded-xl bg-emerald-600 px-3 py-2.5 text-sm font-semibold text-white">
            {t.save}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function AvatarUpload({
  hasAvatar,
  t,
}: {
  hasAvatar: boolean;
  t: { change: string; remove: string; error: string; save: string; cancel: string; zoom: string };
}) {
  const input = useRef<HTMLInputElement>(null);
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(false);
  const [img, setImg] = useState<Img | null>(null);

  useEffect(() => () => {
    if (img) URL.revokeObjectURL(img.url);
  }, [img]);

  async function onFile(file: File | undefined) {
    if (!file) return;
    setErr(false);
    try {
      setImg(await loadImage(file));
    } catch {
      setErr(true);
    } finally {
      if (input.current) input.current.value = "";
    }
  }

  async function upload(blob: Blob) {
    setImg(null);
    setBusy(true);
    try {
      const fd = new FormData();
      fd.append("file", blob, "avatar.jpg");
      const res = await fetch("/api/avatar", { method: "POST", body: fd });
      if (!res.ok) throw new Error(String(res.status));
      router.refresh();
    } catch {
      setErr(true);
    } finally {
      setBusy(false);
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
      {img && <Cropper img={img} onCancel={() => setImg(null)} onDone={upload} t={{ save: t.save, cancel: t.cancel, zoom: t.zoom }} />}
    </div>
  );
}
