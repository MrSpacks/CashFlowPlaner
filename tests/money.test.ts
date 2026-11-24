import { describe, expect, it } from "vitest";
import { budgetOutflow, isCategory } from "@/lib/categories";
import { addMonths, dateInMonth, daysInMonth, parseAmount } from "@/lib/forecast";

describe("budgetOutflow — сколько уйдёт по категории в прогнозе", () => {
  it("пока трачу меньше плана — считается остаток плана", () => {
    expect(budgetOutflow(8000, 2000, 3000)).toBe(6000);
  });
  it("превысил план — считается факт после даты баланса", () => {
    expect(budgetOutflow(8000, 2000, 7000)).toBe(7000);
  });
  it("без плана — только факт", () => {
    expect(budgetOutflow(0, 500, 1200)).toBe(1200);
  });
  it("будущий месяц — весь план", () => {
    expect(budgetOutflow(8000, 0, 0)).toBe(8000);
  });
  it("всё потрачено до баланса — больше ничего не уйдёт", () => {
    expect(budgetOutflow(8000, 9000, 0)).toBe(0);
  });
});

describe("даты и суммы", () => {
  it("addMonths через год", () => {
    expect(addMonths("2026-11", 2)).toBe("2027-01");
    expect(addMonths("2026-01", -1)).toBe("2025-12");
  });
  it("dateInMonth обрезает 31-е", () => {
    expect(dateInMonth("2026-11", 31)).toBe("2026-11-30");
    expect(dateInMonth("2027-02", 30)).toBe("2027-02-28");
    expect(dateInMonth("2026-11", null)).toBe("2026-11-01");
  });
  it("daysInMonth для високосного февраля", () => {
    expect(daysInMonth("2028-02")).toBe(29);
  });
  it("parseAmount понимает пробелы и запятую", () => {
    expect(parseAmount("12 500,50")).toBe(12500.5);
    expect(parseAmount("")).toBeNull();
    expect(parseAmount("abc")).toBeNull();
  });
  it("категории", () => {
    expect(isCategory("food")).toBe(true);
    expect(isCategory("drugs")).toBe(false);
  });
});

import { planStats } from "@/lib/dailyPlan";

describe("статистика плана дня", () => {
  const p = (date: string, done: number, total: number, energy?: number) => ({
    date,
    tasks: Array.from({ length: total }, (_, i) => ({ id: `t${i}` })),
    done: Object.fromEntries(Array.from({ length: done }, (_, i) => [`t${i}`, true])),
    feedback: energy ? { energy } : null,
  });
  it("серия: незаконченный сегодняшний день не рвёт серию", () => {
    const s = planStats([p("2026-11-24", 0, 4), p("2026-11-23", 3, 4), p("2026-11-22", 2, 4), p("2026-11-21", 1, 4)], "2026-11-24");
    expect(s.streak).toBe(2);
  });
  it("процент за неделю и энергия", () => {
    const s = planStats([p("2026-11-24", 2, 4, 4), p("2026-11-23", 4, 4, 2)], "2026-11-24");
    expect(s.week.pct).toBe(75);
    expect(s.week.energy).toBe(3);
  });
});
