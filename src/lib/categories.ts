/** Категории трат и бюджета. Подписи — в словаре (t.cat[key]). */
export const CATEGORIES = ["food", "dining", "home", "transport", "health", "fun", "clothes", "gifts", "other"] as const;
export type Category = (typeof CATEGORIES)[number];

export const CATEGORY_ICON: Record<Category, string> = {
  food: "🛒",
  dining: "🍽️",
  home: "🏠",
  transport: "🚗",
  health: "💊",
  fun: "🎉",
  clothes: "👕",
  gifts: "🎁",
  other: "✨",
};

export function isCategory(v: unknown): v is Category {
  return typeof v === "string" && (CATEGORIES as readonly string[]).includes(v);
}

/**
 * Сколько уйдёт по категории за месяц в прогнозе.
 * plan — лимит (или сумма постоянных расходов с этой категорией), spentBefore — потрачено в этом месяце
 * до даты баланса (уже в балансе), spentAfter — после неё.
 * Пока трачу меньше плана — считаем остаток плана; превысил — считаем факт.
 */
export function budgetOutflow(plan: number, spentBefore: number, spentAfter: number) {
  return Math.max(plan - spentBefore - spentAfter, 0) + spentAfter;
}
