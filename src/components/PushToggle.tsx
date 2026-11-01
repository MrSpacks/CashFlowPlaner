"use client";

import { useEffect, useState } from "react";
import { deletePushSubscription, savePushSubscription, sendTestPush } from "@/app/actions";

type Texts = {
  pushOn: string;
  pushOff: string;
  pushEnabled: string;
  pushUnsupported: string;
  pushDenied: string;
  test: string;
};

function keyToBytes(base64url: string) {
  const pad = "=".repeat((4 - (base64url.length % 4)) % 4);
  const raw = atob((base64url + pad).replace(/-/g, "+").replace(/_/g, "/"));
  return Uint8Array.from(raw, (c) => c.charCodeAt(0));
}

export default function PushToggle({ t }: { t: Texts }) {
  const [state, setState] = useState<"loading" | "unsupported" | "denied" | "off" | "on">("loading");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    (async () => {
      if (!("serviceWorker" in navigator) || !("PushManager" in window) || !("Notification" in window)) {
        setState("unsupported");
        return;
      }
      if (Notification.permission === "denied") {
        setState("denied");
        return;
      }
      const reg = await navigator.serviceWorker.getRegistration();
      const sub = await reg?.pushManager.getSubscription();
      setState(sub ? "on" : "off");
    })().catch(() => setState("unsupported"));
  }, []);

  async function enable() {
    setBusy(true);
    try {
      const perm = await Notification.requestPermission();
      if (perm !== "granted") {
        setState(perm === "denied" ? "denied" : "off");
        return;
      }
      const reg = (await navigator.serviceWorker.getRegistration()) ?? (await navigator.serviceWorker.register("/sw.js"));
      await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: keyToBytes(process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? ""),
      });
      await savePushSubscription(JSON.stringify(sub));
      setState("on");
    } catch {
      setState("unsupported");
    } finally {
      setBusy(false);
    }
  }

  async function disable() {
    setBusy(true);
    try {
      const reg = await navigator.serviceWorker.getRegistration();
      const sub = await reg?.pushManager.getSubscription();
      if (sub) {
        await deletePushSubscription(sub.endpoint);
        await sub.unsubscribe();
      }
      setState("off");
    } finally {
      setBusy(false);
    }
  }

  if (state === "loading") return <div className="h-10" />;
  if (state === "unsupported") return <p className="text-xs text-slate-500">{t.pushUnsupported}</p>;
  if (state === "denied") return <p className="text-xs text-amber-700">{t.pushDenied}</p>;

  if (state === "off")
    return (
      <button onClick={enable} disabled={busy} className="w-full rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50">
        🔔 {t.pushOn}
      </button>
    );

  return (
    <div className="space-y-2">
      <p className="text-sm text-emerald-700">✓ {t.pushEnabled}</p>
      <div className="flex gap-2">
        <button
          onClick={async () => {
            setBusy(true);
            await sendTestPush().finally(() => setBusy(false));
          }}
          disabled={busy}
          className="flex-1 rounded-xl border border-slate-300 px-3 py-2 text-sm disabled:opacity-50"
        >
          {t.test}
        </button>
        <button onClick={disable} disabled={busy} className="flex-1 rounded-xl border border-slate-300 px-3 py-2 text-sm text-slate-600 disabled:opacity-50">
          {t.pushOff}
        </button>
      </div>
    </div>
  );
}
