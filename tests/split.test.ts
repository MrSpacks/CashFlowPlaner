import { describe, expect, it } from "vitest";
import type { EventRow, ItemRow, ParticipantRow, ShareRow } from "@/lib/events";
import { nextOccurrence, occurrence, occurrenceInMonth } from "@/lib/events";
import { eventBalances, sharesOf, transfers } from "@/lib/split";

const ev = { id: "e1", createdBy: "u1" } as EventRow;
const parts = [
  { id: "p1", eventId: "e1", userId: "u1" },
  { id: "p2", eventId: "e1", userId: "u2" },
] as ParticipantRow[];
const item = (over: Partial<ItemRow> = {}) =>
  ({ id: "i1", eventId: "e1", amount: "4200", currency: "CZK", status: "paid", paidByParticipantId: null, ...over }) as ItemRow;
const share = (participantId: string, shareType: string, value: string | null) =>
  ({ expenseItemId: "i1", participantId, shareType, value }) as unknown as ShareRow;

describe("разделение трат", () => {
  it("без долей — поровну", () => {
    const s = sharesOf(item(), parts, []);
    expect(s.get("p1")).toBe(2100);
    expect(s.get("p2")).toBe(2100);
  });
  it("свободное разделение: 3000 мне, остаток жене", () => {
    const s = sharesOf(item(), parts, [share("p1", "amount", "3000"), share("p2", "equal", null)]);
    expect(s.get("p1")).toBe(3000);
    expect(s.get("p2")).toBe(1200);
  });
  it("кто кому должен: я заплатил 4200 пополам — жена должна 2100", () => {
    const bal = eventBalances(ev, [item()], [], parts, [], []);
    const tr = transfers(bal);
    expect(tr).toEqual([{ from: "p2", to: "p1", amount: 2100 }]);
  });
  it("неоплаченная трата долгов не создаёт", () => {
    const bal = eventBalances(ev, [item({ status: "unpaid" })], [], parts, [], []);
    expect(transfers(bal)).toEqual([]);
  });
});

describe("повторяющиеся события", () => {
  it("ежемесячно 31-го — в ноябре 30-го", () => {
    expect(occurrence("2026-10-31", "monthly", 1)).toBe("2026-11-30");
  });
  it("ежегодно — следующий раз после даты", () => {
    expect(nextOccurrence("1960-11-21", "yearly", "2026-11-24")).toBe("2027-11-21");
  });
  it("день рождения 29 февраля в невисокосный год", () => {
    expect(occurrenceInMonth("2024-02-29", "yearly", "2027-02")).toMatch(/^2027-02-2[89]$/);
  });
});
