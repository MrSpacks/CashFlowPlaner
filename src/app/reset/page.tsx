import Link from "next/link";
import { resetPasswordAction } from "@/app/actions";
import { btnCls, inputCls, labelCls } from "@/components/ui";
import { getI18n } from "@/i18n/server";

export default async function ResetPage({ searchParams }: { searchParams: Promise<{ token?: string; error?: string }> }) {
  const { t } = await getI18n();
  const { token, error } = await searchParams;
  const bad = !token || error === "expired" || error === "INVALID_TOKEN";
  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-sm flex-col justify-center px-6 py-10">
      <h1 className="mb-6 text-2xl font-bold">{t.auth.resetTitle}</h1>
      {bad ? (
        <p className="rounded-xl bg-rose-50 px-3 py-2 text-sm text-rose-700">
          {t.auth.resetExpired}{" "}
          <Link href="/forgot" className="font-medium underline">
            {t.auth.forgotSend}
          </Link>
        </p>
      ) : (
        <form action={resetPasswordAction} className="space-y-4">
          <input type="hidden" name="token" value={token} />
          <div>
            <label className={labelCls} htmlFor="password">{t.auth.password}</label>
            <input id="password" name="password" type="password" required minLength={8} autoComplete="new-password" className={inputCls} />
            <p className={`mt-1 text-xs ${error === "password" ? "text-rose-600" : "text-slate-400"}`}>{t.auth.passwordHint}</p>
          </div>
          <button className={`${btnCls} w-full`}>{t.auth.resetSave}</button>
        </form>
      )}
      <Link href="/login" className="mt-6 text-center text-sm font-medium text-emerald-700">
        ← {t.auth.back}
      </Link>
    </div>
  );
}
