import type { Metadata, Viewport } from "next";
import "./globals.css";
import BottomNav from "@/components/BottomNav";
import RegisterSW from "@/components/RegisterSW";

export const metadata: Metadata = {
  title: "CashFlowPlaner",
  description: "Планирование событий, трат и денег по месяцам",
  applicationName: "CashFlowPlaner",
  appleWebApp: {
    capable: true,
    title: "CashFlow",
    statusBarStyle: "default",
  },
  icons: {
    icon: [
      { url: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: "/icons/apple-touch-icon.png",
  },
};

export const viewport: Viewport = {
  themeColor: "#059669",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ru">
      <body className="min-h-dvh antialiased">
        <main className="mx-auto min-h-dvh max-w-xl pb-28">{children}</main>
        <BottomNav />
        <RegisterSW />
      </body>
    </html>
  );
}
