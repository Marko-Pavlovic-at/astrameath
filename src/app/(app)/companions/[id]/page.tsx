import ChatView from "@/components/companions/chat-view";

export const metadata = { title: "Companion" };

export default async function CompanionPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <ChatView id={id} />;
}
