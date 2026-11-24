/**
 * Ошибка на сервере → push владельцу приложения (не чаще раза в 10 минут на экземпляр),
 * чтобы узнавать о поломке сразу, а не случайно.
 */
const OWNER = process.env.ADMIN_USER_ID ?? "Oku3jXJiTlMJmVMh9Oqal4hj1Kq8FoKb";
let lastSent = 0;

export async function register() {}

export async function onRequestError(
  err: unknown,
  request: { path: string; method: string },
  context: { routerKind: string; routeType: string },
) {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  const now = Date.now();
  if (now - lastSent < 10 * 60_000) return;
  lastSent = now;
  try {
    const { sendPushToUser } = await import("@/lib/push");
    const msg = err instanceof Error ? err.message : String(err);
    await sendPushToUser(
      OWNER,
      () => ({
        title: "⚠️ CashFlowPlaner: ошибка на сервере",
        body: `${request.method} ${request.path} (${context.routeType}): ${msg}`.slice(0, 180),
        url: "/",
        tag: "server-error",
      }),
      { store: false },
    );
  } catch {
    // оповещение не должно ломать ответ
  }
}
