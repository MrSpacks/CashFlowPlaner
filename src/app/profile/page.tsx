import Link from "next/link";
import { updateProfile } from "@/app/actions";
import Avatar from "@/components/Avatar";
import AvatarUpload from "@/components/AvatarUpload";
import PageHeader from "@/components/PageHeader";
import QrCode from "@/components/QrCode";
import { btnCls, Card, cardCls, inputCls, labelCls, RowLink } from "@/components/ui";
import { getI18n } from "@/i18n/server";
import { requireUser } from "@/lib/auth";
import { getProfile } from "@/lib/finance";
import { avatarUrl, ensureUsername } from "@/lib/people";

export const dynamic = "force-dynamic";

export default async function ProfilePage({ searchParams }: { searchParams: Promise<{ saved?: string; error?: string }> }) {
  const user = await requireUser();
  const { t } = await getI18n();
  const username = await ensureUsername(user.id);
  const profile = await getProfile(user.id);
  const { saved, error } = await searchParams;
  const src = avatarUrl(user.id, profile.avatarUpdatedAt);

  return (
    <div className="lg:max-w-2xl">
      <PageHeader title={t.pr.title} />
      <div className="space-y-4 px-4">
        {saved && <p className="rounded-xl bg-emerald-50 px-3 py-2 text-sm text-emerald-800">✓ {t.pr.saved}</p>}
        {error && (
          <p className="rounded-xl bg-rose-50 px-3 py-2 text-sm text-rose-700">
            {error === "taken" ? t.pr.usernameTaken : t.pr.usernameInvalid}
          </p>
        )}

        <Card>
          <div className="flex items-center gap-4">
            <Avatar name={user.name} src={src} seed={user.id} size={72} />
            <div className="min-w-0">
              <p className="truncate text-lg font-semibold">{user.name}</p>
              <p className="truncate text-sm text-slate-500">@{username}</p>
              <div className="mt-2">
                <AvatarUpload hasAvatar={!!src} t={{ change: t.pr.changePhoto, remove: t.pr.removePhoto, error: t.pr.photoError, save: t.common.save, cancel: t.fr.cancel, zoom: t.pr.zoom }} />
              </div>
            </div>
          </div>
        </Card>

        <Card>
          <form action={updateProfile} className="space-y-3">
            <div>
              <label className={labelCls}>{t.pr.name}</label>
              <input name="name" defaultValue={user.name} required className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>{t.pr.username}</label>
              <div className="flex items-center gap-1">
                <span className="text-slate-400">@</span>
                <input
                  name="username"
                  defaultValue={username}
                  required
                  pattern="[a-zA-Z0-9_.]{3,20}"
                  autoCapitalize="none"
                  className={inputCls}
                />
              </div>
              <p className="mt-1 text-xs text-slate-400">{t.pr.usernameHint}</p>
            </div>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" name="searchable" defaultChecked={profile.searchable} className="h-5 w-5 accent-emerald-600" />
              {t.pr.searchable}
            </label>
            <button className={`${btnCls} w-full`}>{t.common.save}</button>
          </form>
        </Card>

        <Card>
          <p className="mb-2 font-semibold">{t.pr.myQr}</p>
          <QrCode path={`/u/${username}`} label={t.pr.myQr} hint={t.pr.myQrHint} />
        </Card>

        <div className={`${cardCls} overflow-hidden`}>
          <RowLink href="/people" label={t.fr.title} />
        </div>
        <Link href="/more" className="block text-center text-sm text-emerald-700">
          {t.pr.settings} →
        </Link>
      </div>
    </div>
  );
}
