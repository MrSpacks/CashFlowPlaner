import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "CashFlowPlaner",
    short_name: "CashFlow",
    description: "Планирование событий, трат и денег по месяцам",
    start_url: "/",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#f8fafc",
    theme_color: "#059669",
    lang: "ru",
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
      { src: "/icons/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
    // Долгое нажатие на значок приложения (Android, компьютер): быстрые действия.
    shortcuts: [
      { name: "Útrata", short_name: "Útrata", url: "/spend", icons: [{ src: "/icons/icon-192.png", sizes: "192x192" }] },
      { name: "Nová událost", short_name: "Událost", url: "/events/new", icons: [{ src: "/icons/icon-192.png", sizes: "192x192" }] },
      { name: "Kalendář", short_name: "Kalendář", url: "/calendar", icons: [{ src: "/icons/icon-192.png", sizes: "192x192" }] },
      { name: "Hledat", short_name: "Hledat", url: "/search", icons: [{ src: "/icons/icon-192.png", sizes: "192x192" }] },
    ],
  };
}
