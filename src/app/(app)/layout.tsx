import { redirect } from "next/navigation";
import Nav from "@/components/nav";
import { createClient } from "@/lib/supabase/server";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  return (
    <div className="min-h-dvh md:flex">
      <Nav />
      <main className="flex-1 p-4 pb-24 md:p-8 md:pb-8">{children}</main>
    </div>
  );
}
