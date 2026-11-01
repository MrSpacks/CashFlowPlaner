import { cookies, headers } from "next/headers";
import { DICTIONARIES, INTL_LOCALE, isLocale, type Locale } from "./dictionaries";

/** Язык: сначала ручной выбор (cookie), иначе язык телефона/браузера. */
export async function getLocale(): Promise<Locale> {
  const chosen = (await cookies()).get("lang")?.value;
  if (isLocale(chosen)) return chosen;
  return detectFromHeader((await headers()).get("accept-language") ?? "");
}

export function detectFromHeader(acceptLanguage: string): Locale {
  for (const part of acceptLanguage.split(",")) {
    const tag = part.split(";")[0].trim().toLowerCase().slice(0, 2);
    if (isLocale(tag)) return tag;
    if (tag === "sk") return "cs";
  }
  return "en";
}

export async function getI18n() {
  const locale = await getLocale();
  return { locale, t: DICTIONARIES[locale], intl: INTL_LOCALE[locale] };
}
