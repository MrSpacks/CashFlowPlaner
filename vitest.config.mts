import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

// Тесты денежной логики: запускаются перед каждой сборкой на Vercel — упал тест, сайт не обновится.
export default defineConfig({
  resolve: { alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) } },
  test: { include: ["tests/**/*.test.ts"], environment: "node" },
});
