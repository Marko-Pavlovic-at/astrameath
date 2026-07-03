import CompanionForm from "@/components/companions/companion-form";

export const metadata = { title: "Edit companion" };

export default async function EditCompanionPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <CompanionForm id={id} />;
}
