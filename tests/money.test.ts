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
