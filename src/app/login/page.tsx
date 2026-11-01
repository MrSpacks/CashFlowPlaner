import { redirect } from "next/navigation";
import AuthForm from "@/components/AuthForm";
import { getI18n } from "@/i18n/server";
import { getSession, googleEnabled } from "@/lib/auth";

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ error?: string; next?: string }> }) {
  if (await getSession()) redirect((await searchParams).next?.startsWith("/") ? (await searchParams).next! : "/");
  const { t } = await getI18n();
  const { error, next } = await searchParams;
  return <AuthForm mode="login" t={t.auth} error={error} google={googleEnabled} next={next} />;
}
