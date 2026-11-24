import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { nextCookies } from "better-auth/next-js";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { db } from "@/db";
import { authAccount, authSession, authUser, authVerification, calendars, profiles } from "@/db/schema";

export const googleEnabled = Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET);

export const auth = betterAuth({
  baseURL: process.env.BETTER_AUTH_URL,
  secret: process.env.BETTER_AUTH_SECRET,
  database: drizzleAdapter(db, {
    provider: "pg",
    schema: { user: authUser, session: authSession, account: authAccount, verification: authVerification },
  }),
  emailAndPassword: {
    enabled: true,
    minPasswordLength: 8,
    autoSignIn: true,
    // Восстановление пароля: письмо со ссылкой (через Resend, если задан RESEND_API_KEY).
    sendResetPassword: async ({ user, url }) => {
      await sendMail(
        user.email,
        "CashFlowPlaner — obnova hesla / восстановление пароля",
        `<p>Dobrý den / Здравствуйте, ${escapeHtml(user.name || "")}!</p>
<p>Pro nastavení nového hesla klikněte na odkaz (platí 1 hodinu).<br/>Чтобы задать новый пароль, откройте ссылку (действует 1 час):</p>
<p><a href="${url}">${url}</a></p>
<p style="color:#64748b">Pokud jste o to nežádali, e-mail ignorujte. / Если вы этого не просили — просто проигнорируйте письмо.</p>`,
      );
    },
    resetPasswordTokenExpiresIn: 3600,
  },
  socialProviders: googleEnabled
    ? {
        google: {
          clientId: process.env.GOOGLE_CLIENT_ID as string,
          clientSecret: process.env.GOOGLE_CLIENT_SECRET as string,
        },
      }
    : {},
  session: { expiresIn: 60 * 60 * 24 * 60, updateAge: 60 * 60 * 24 },
  databaseHooks: {
    user: {
      create: {
        // Новому пользователю — профиль и личный календарь.
        after: async (user) => {
          await db.insert(profiles).values({ userId: user.id, displayName: user.name }).onConflictDoNothing();
          await db.insert(calendars).values({ ownerId: user.id, name: user.name || "Calendar" });
        },
      },
    },
  },
  plugins: [nextCookies()],
});

const escapeHtml = (v: string) => v.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!);

/** Отправить письмо через Resend API. Без ключа — тихо ничего не делаем. */
export async function sendMail(to: string, subject: string, html: string) {
  const key = process.env.RESEND_API_KEY;
  const from = process.env.MAIL_FROM; // адрес с доменом этого приложения, например "CashFlowPlaner <noreply@домен>"
  if (!key || !from) return false;
  const r = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from, to, subject, html }),
  });
  return r.ok;
}
export const mailEnabled = Boolean(process.env.RESEND_API_KEY && process.env.MAIL_FROM);

export async function getSession() {
  return auth.api.getSession({ headers: await headers() });
}

/** Текущий пользователь; без входа — на страницу логина. */
export async function requireUser() {
  const session = await getSession();
  if (!session) redirect("/login");
  return session.user;
}
