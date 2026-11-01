import PageHeader from "@/components/PageHeader";
import { getI18n } from "@/i18n/server";
import { requireUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function IdeasPage() {
  await requireUser();
  const { t } = await getI18n();
  return (
    <>
      <PageHeader title={t.ideas.title} subtitle={t.ideas.subtitle} />
      <div className="mx-4 rounded-2xl border border-dashed border-slate-300 p-6 text-center text-sm text-slate-500">
        {t.ideas.empty}
      </div>
    </>
  );
}
