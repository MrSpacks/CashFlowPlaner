import EventForm from "@/components/EventForm";
import PageHeader from "@/components/PageHeader";
import { BackLink, Card } from "@/components/ui";
import { getI18n } from "@/i18n/server";
import { requireUser } from "@/lib/auth";
import { getProfile } from "@/lib/finance";

export const dynamic = "force-dynamic";

export default async function NewEventPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; start?: string; type?: string }>;
}) {
  const user = await requireUser();
  const { t } = await getI18n();
  const profile = await getProfile(user.id);
  const defaults = await searchParams;

  return (
    <>
      <BackLink href="/calendar" label={t.calendar.title} />
      <PageHeader title={t.ev.newTitle} />
      <div className="px-4">
        <Card>
          <EventForm t={t.ev} defaults={defaults} baseCurrency={profile.baseCurrency} />
        </Card>
      </div>
    </>
  );
}
