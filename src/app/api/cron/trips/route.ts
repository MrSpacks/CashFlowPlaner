import { eq } from "drizzle-orm";
import { db } from "@/db";
import { authUser, tripSettings } from "@/db/schema";
import { DICTIONARIES, INTL_LOCALE, isLocale } from "@/i18n/dictionaries";
import { formatDate, formatMoney } from "@/lib/forecast";
import { sendPushToUser } from "@/lib/push";
import { canUseTrips, dealKey, getTripPrefs, listTripDeals, refreshTripDeals } from "@/lib/trips";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/** Раз в день (Vercel Cron): обновить «Дешёвые выходные» и прислать push о новом выгодном варианте. */
export async function GET(req: Request) {
  if (req.headers.get("authorization") !== `Bearer ${process.env.CRON_SECRET}`) {
    return new Response("Unauthorized", { status: 401 });
  }
  const report = await refreshTripDeals();

  const users = (await db.select({ u: authUser.id }).from(authUser)).map((r) => r.u).filter(canUseTrips);
  let notified = 0;
  for (const userId of users) {
    const prefs = await getTripPrefs(userId);
    if (!prefs.notify) continue;
    const fresh = (await listTripDeals({ modes: prefs.modes, maxPrice: prefs.maxPrice })).filter((d) => !prefs.notified.includes(dealKey(d)));
    if (!fresh.length) continue;
    const best = fresh[0];

    await sendPushToUser(userId, (loc) => {
      const lang = isLocale(loc) ? loc : "en";
      const t = DICTIONARIES[lang].trp;
      const intl = INTL_LOCALE[lang];
      const dates = `${formatDate(best.outDep.slice(0, 10), intl)} – ${formatDate(best.inDep.slice(0, 10), intl)}`;
      return {
        title: t.pushTitle,
        body: t.pushBody(best.destName, formatMoney(Number(best.price), best.currency, intl), dates, fresh.length - 1),
        url: "/ideas",
        tag: "trips",
      };
    });
    const keys = [...fresh.map(dealKey), ...prefs.notified].slice(0, 100);
    await db
      .insert(tripSettings)
      .values({ userId, notified: keys })
      .onConflictDoUpdate({ target: tripSettings.userId, set: { notified: keys } });
    notified++;
  }
  return Response.json({ ok: true, report, notified });
}
