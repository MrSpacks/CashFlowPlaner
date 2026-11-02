import type { Metadata, Viewport } from "next";
import "./globals.css";
import BottomNav from "@/components/BottomNav";
import RegisterSW from "@/components/RegisterSW";
import { getI18n, getTheme } from "@/i18n/server";
import { getSession } from "@/lib/auth";
import { unreadTotal } from "@/lib/chat";
import { getProfile } from "@/lib/finance";
import { avatarUrl, countIncomingRequests } from "@/lib/people";

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
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#059669" },
    { media: "(prefers-color-scheme: dark)", color: "#020617" },
  ],
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

// Тема «как в системе»: выставляется до отрисовки, чтобы не мигало, и следит за сменой.
const SYSTEM_THEME_SCRIPT = `(function(){var m=window.matchMedia('(prefers-color-scheme: dark)');function a(){document.documentElement.dataset.theme=m.matches?'dark':'light'}a();m.addEventListener('change',a)})()`;

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const [{ locale, t }, theme, session] = await Promise.all([getI18n(), getTheme(), getSession()]);
  // Значки непрочитанного и аватарка для меню (без входа — пусто).
  let badges = { chats: 0, people: 0 };
  let me: { id: string; name: string; avatar: string | null } | null = null;
  if (session) {
    try {
      const [chats, people, profile] = await Promise.all([
        unreadTotal(session.user.id),
        countIncomingRequests(session.user.id),
        getProfile(session.user.id),
      ]);
      badges = { chats, people };
      me = { id: session.user.id, name: session.user.name, avatar: avatarUrl(session.user.id, profile?.avatarUpdatedAt) };
    } catch {
      // меню без значков лучше, чем упавшая страница
    }
  }
  return (
    <html lang={locale} data-theme={theme === "system" ? undefined : theme} suppressHydrationWarning>
      <head>{theme === "system" && <script dangerouslySetInnerHTML={{ __html: SYSTEM_THEME_SCRIPT }} />}</head>
      <body className="min-h-dvh antialiased">
        <div id="content">
          <main className="mx-auto min-h-dvh max-w-xl pb-28 lg:max-w-5xl lg:px-6 lg:pt-4 lg:pb-12">{children}</main>
        </div>
        <BottomNav labels={t.nav} badges={badges} me={me} />
        <RegisterSW />
      </body>
    </html>
  );
}
