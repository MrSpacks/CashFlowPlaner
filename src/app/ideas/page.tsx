import PageHeader from "@/components/PageHeader";

export default function IdeasPage() {
  return (
    <>
      <PageHeader title="Идеи" subtitle="События без даты: «когда-нибудь хотим…»" />
      <div className="mx-4 rounded-2xl border border-dashed border-slate-300 p-6 text-center text-sm text-slate-500">
        Здесь будут идеи поездок и покупок. Любую идею можно будет одним нажатием превратить в событие с датой и
        бюджетом.
      </div>
    </>
  );
}
