import { headers } from "next/headers";
import QRCode from "qrcode";

/** Полный адрес сайта для ссылок (как его видит телефон). */
export async function baseUrl() {
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "cashflowplaner.vercel.app";
  const proto = h.get("x-forwarded-proto") ?? "https";
  return `${proto}://${host}`;
}

/** Сворачиваемый QR-код ссылки — второй человек просто наводит камеру. */
export default async function QrCode({ path, label, hint }: { path: string; label: string; hint: string }) {
  const url = `${await baseUrl()}${path}`;
  const svg = await QRCode.toString(url, { type: "svg", margin: 1, errorCorrectionLevel: "M", color: { dark: "#0f172a", light: "#ffffff" } });
  return (
    <details className="group">
      <summary className="inline-flex cursor-pointer list-none items-center gap-1 rounded-lg bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-700 active:bg-slate-200">
        <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth={2}>
          <path d="M4 4h6v6H4zM14 4h6v6h-6zM4 14h6v6H4zM14 14h2v2h-2zM18 14h2v2h-2zM14 18h2v2h-2zM18 18h2v2h-2z" />
        </svg>
        {label}
      </summary>
      <div className="mt-3 rounded-2xl bg-white p-3 text-center ring-1 ring-slate-200">
        <div className="mx-auto w-52 [&>svg]:h-auto [&>svg]:w-full" dangerouslySetInnerHTML={{ __html: svg }} />
        <p className="mt-2 text-xs text-slate-500">{hint}</p>
      </div>
    </details>
  );
}
