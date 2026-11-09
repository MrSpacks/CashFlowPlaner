import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";
import { desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { investmentAccounts, investmentSnapshots, type InvestmentPosition } from "@/db/schema";

/** Кому доступен раздел «Инвестиции». Только владелец; можно расширить через INVEST_USER_IDS. */
const DEFAULT_OWNERS = ["Oku3jXJiTlMJmVMh9Oqal4hj1Kq8FoKb"];
export function investUserIds() {
  const env = process.env.INVEST_USER_IDS;
  return env ? env.split(",").map((s) => s.trim()).filter(Boolean) : DEFAULT_OWNERS;
}
export function canUseInvest(userId: string | null | undefined) {
  return !!userId && investUserIds().includes(userId);
}

// ---------- шифрование ключей ----------
function cryptoKey() {
  const base = process.env.BETTER_AUTH_SECRET;
  if (!base) throw new Error("no secret");
  return createHash("sha256").update(`cfp-invest:${base}`).digest();
}
export function encrypt(plain: string) {
  const iv = randomBytes(12);
  const c = createCipheriv("aes-256-gcm", cryptoKey(), iv);
  const enc = Buffer.concat([c.update(plain, "utf8"), c.final()]);
  return [iv, c.getAuthTag(), enc].map((b) => b.toString("base64")).join(".");
}
function decrypt(blob: string) {
  const [iv, tag, enc] = blob.split(".").map((s) => Buffer.from(s, "base64"));
  const d = createDecipheriv("aes-256-gcm", cryptoKey(), iv);
  d.setAuthTag(tag);
  return Buffer.concat([d.update(enc), d.final()]).toString("utf8");
}

// ---------- Trading 212 ----------
const BASE = { live: "https://live.trading212.com/api/v0", demo: "https://demo.trading212.com/api/v0" } as const;

type Summary = {
  currency: string;
  totalValue: number;
  cash?: { availableToTrade?: number; inPies?: number; reservedForOrders?: number };
  investments?: { currentValue?: number; totalCost?: number; unrealizedProfitLoss?: number; realizedProfitLoss?: number };
};
type Position = {
  quantity: number;
  instrument?: { ticker?: string; name?: string; currency?: string };
  walletImpact?: { currentValue?: number; totalCost?: number; unrealizedProfitLoss?: number };
};

async function t212<T>(env: string, auth: string, path: string): Promise<T> {
  const r = await fetch(`${BASE[env === "demo" ? "demo" : "live"]}${path}`, {
    headers: { Authorization: auth },
    cache: "no-store",
  });
  if (!r.ok) {
    const why =
      r.status === 401 ? "401: неверный ключ или секрет" :
      r.status === 403 ? "403: у ключа нет нужных прав (Account data, Portfolio)" :
      r.status === 429 ? "429: слишком часто, попробуйте через минуту" : `${r.status}`;
    throw new Error(why);
  }
  return (await r.json()) as T;
}

export async function getInvestAccount(userId: string) {
  const [a] = await db.select().from(investmentAccounts).where(eq(investmentAccounts.ownerId, userId)).limit(1);
  return a ?? null;
}

export async function latestSnapshot(userId: string) {
  const [s] = await db
    .select()
    .from(investmentSnapshots)
    .where(eq(investmentSnapshots.ownerId, userId))
    .orderBy(desc(investmentSnapshots.takenAt))
    .limit(1);
  return s ?? null;
}

/** Снять свежий снимок портфеля, если прошлый старше maxAgeMin. Ошибку сохраняем в last_error. */
export async function refreshSnapshot(userId: string, maxAgeMin = 10) {
  const acc = await getInvestAccount(userId);
  if (!acc) return null;
  const last = await latestSnapshot(userId);
  if (last && Date.now() - last.takenAt.getTime() < maxAgeMin * 60_000) return last;
  try {
    const auth = `Basic ${Buffer.from(`${decrypt(acc.keyEnc)}:${decrypt(acc.secretEnc)}`).toString("base64")}`;
    const summary = await t212<Summary>(acc.env, auth, "/equity/account/summary");
    const positions = await t212<Position[]>(acc.env, auth, "/equity/positions");
    const pos: InvestmentPosition[] = positions
      .map((p) => ({
        ticker: p.instrument?.ticker ?? "?",
        name: p.instrument?.name ?? p.instrument?.ticker ?? "?",
        quantity: Number(p.quantity ?? 0),
        currency: p.instrument?.currency ?? summary.currency,
        value: Number(p.walletImpact?.currentValue ?? 0),
        cost: Number(p.walletImpact?.totalCost ?? 0),
        pl: Number(p.walletImpact?.unrealizedProfitLoss ?? 0),
      }))
      .sort((a, b) => b.value - a.value);
    const inv = summary.investments ?? {};
    const cash = Number(summary.cash?.availableToTrade ?? 0) + Number(summary.cash?.inPies ?? 0) + Number(summary.cash?.reservedForOrders ?? 0);
    const [snap] = await db
      .insert(investmentSnapshots)
      .values({
        ownerId: userId,
        currency: (summary.currency ?? "EUR").slice(0, 3),
        totalValue: Number(summary.totalValue ?? 0).toFixed(2),
        cash: cash.toFixed(2),
        investedValue: Number(inv.currentValue ?? 0).toFixed(2),
        totalCost: Number(inv.totalCost ?? 0).toFixed(2),
        unrealizedPl: Number(inv.unrealizedProfitLoss ?? 0).toFixed(2),
        realizedPl: Number(inv.realizedProfitLoss ?? 0).toFixed(2),
        positions: pos,
      })
      .returning();
    if (acc.lastError) await db.update(investmentAccounts).set({ lastError: null }).where(eq(investmentAccounts.ownerId, userId));
    return snap;
  } catch (e) {
    await db
      .update(investmentAccounts)
      .set({ lastError: e instanceof Error ? e.message.slice(0, 200) : "error" })
      .where(eq(investmentAccounts.ownerId, userId));
    return last;
  }
}

/** Утром до «Плана дня» (06:10–06:20 по Праге) обновить снимки всех подключённых. */
export const INVEST_MORNING_TIME = "06:10";
export async function refreshAllMorning() {
  const accs = await db.select({ ownerId: investmentAccounts.ownerId }).from(investmentAccounts);
  let n = 0;
  for (const a of accs) {
    if (!canUseInvest(a.ownerId)) continue;
    await refreshSnapshot(a.ownerId, 60);
    n++;
  }
  return n;
}
