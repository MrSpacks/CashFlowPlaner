import Link from "next/link";
import { signInAction, signInGoogleAction, signUpAction } from "@/app/actions";
import { btnCls, btnGhostCls, inputCls, labelCls } from "@/components/ui";
import type { Dict } from "@/i18n/dictionaries";

export default function AuthForm({
  mode,
  t,
  error,
  google,
}: {
  mode: "login" | "register";
  t: Dict["auth"];
  error?: string;
  google: boolean;
}) {
  const isLogin = mode === "login";
  const errText =
    error === "invalid" ? t.errInvalid : error === "exists" ? t.errExists : error === "password" ? t.passwordHint : error ? t.errGeneric : null;

  return (
    <div className="flex min-h-dvh flex-col justify-center px-6 py-10">
      <div className="mb-8 text-center">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/icons/icon-192.png" alt="" className="mx-auto mb-3 h-16 w-16 rounded-2xl" />
        <h1 className="text-2xl font-bold text-slate-900">{isLogin ? t.loginTitle : t.registerTitle}</h1>
        <p className="mt-1 text-sm text-slate-500">{t.tagline}</p>
      </div>

      {errText && <p className="mb-4 rounded-xl bg-rose-50 px-3 py-2 text-sm text-rose-700">{errText}</p>}

      <form action={isLogin ? signInAction : signUpAction} className="space-y-4">
        {!isLogin && (
          <div>
            <label className={labelCls} htmlFor="name">{t.name}</label>
            <input id="name" name="name" autoComplete="name" className={inputCls} />
          </div>
        )}
        <div>
          <label className={labelCls} htmlFor="email">{t.email}</label>
          <input id="email" name="email" type="email" required autoComplete="email" className={inputCls} />
        </div>
        <div>
          <label className={labelCls} htmlFor="password">{t.password}</label>
          <input
            id="password"
            name="password"
            type="password"
            required
            minLength={8}
            autoComplete={isLogin ? "current-password" : "new-password"}
            className={inputCls}
          />
          {!isLogin && <p className="mt-1 text-xs text-slate-400">{t.passwordHint}</p>}
        </div>
        <button type="submit" className={`${btnCls} w-full`}>
          {isLogin ? t.login : t.register}
        </button>
      </form>

      {google && (
        <>
          <div className="my-5 flex items-center gap-3 text-xs text-slate-400">
            <span className="h-px flex-1 bg-slate-200" />
            {t.or}
            <span className="h-px flex-1 bg-slate-200" />
          </div>
          <form action={signInGoogleAction}>
            <button type="submit" className={`${btnGhostCls} w-full gap-2`}>
              <svg viewBox="0 0 48 48" className="h-5 w-5">
                <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z" />
                <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z" />
                <path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-7.9l-6.5 5C9.5 39.6 16.2 44 24 44z" />
                <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z" />
              </svg>
              {t.google}
            </button>
          </form>
        </>
      )}

      <p className="mt-8 text-center text-sm text-slate-500">
        {isLogin ? t.noAccount : t.haveAccount}{" "}
        <Link href={isLogin ? "/register" : "/login"} className="font-medium text-emerald-700">
          {isLogin ? t.register : t.login}
        </Link>
      </p>
    </div>
  );
}
