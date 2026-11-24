import Link from "next/link";
import { forgotPasswordAction } from "@/app/actions";
import { btnCls, inputCls, labelCls } from "@/components/ui";
import { getI18n } from "@/i18n/server";
import { mailEnabled } from "@/lib/auth";

export default async function ForgotPage({ searchParams }: { searchParams: Promise<{ sent?: string }> }) {
  const { t } = await getI18n();
  const { sent } = await searchParams;
  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-sm flex-col justify-center px-6 py-10">
      <h1 className="mb-1 text-2xl font-bold">{t.auth.forgotTitle}</h1>
      <p className="mb-6 text-sm text-slate-500">{t.auth.forgotHint}</p>
      {!mailEnabled && <p className="mb-4 rounded-xl bg-amber-50 px-3 py-2 text-sm text-amber-800">{t.auth.forgotOff}</p>}
      {sent ? (
        <p className="rounded-xl bg-emerald-50 px-3 py-2 text-sm text-emerald-800">{t.auth.forgotSent}</p>
      ) : (
        <form action={forgotPasswordAction} className="space-y-4">
          <div>
            <label className={labelCls} htmlFor="email">{t.auth.email}</label>
            <input id="email" name="email" type="email" required autoComplete="email" className={inputCls} />
          </div>
          <button className={`${btnCls} w-full`} disabled={!mailEnabled}>{t.auth.forgotSend}</button>
        </form>
      )}
      <Link href="/login" className="mt-6 text-center text-sm font-medium text-emerald-700">
        ← {t.auth.back}
      </Link>
    </div>
  );
}
