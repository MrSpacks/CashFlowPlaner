import type { Metadata, Viewport } from "next";
import "./globals.css";
import BottomNav from "@/components/BottomNav";
import RegisterSW from "@/components/RegisterSW";
import { getI18n } from "@/i18n/server";

export const metadata: Metadata = {
  title: "CashFlowPlaner",
  description: "Events, expenses and money planning by month",
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

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const { locale, t } = await getI18n();
  return (
    <html lang={locale}>
      <body className="min-h-dvh antialiased">
        <main className="mx-auto min-h-dvh max-w-xl pb-28">{children}</main>
        <BottomNav labels={t.nav} />
        <RegisterSW />
      </body>
    </html>
  );
}
