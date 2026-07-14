import { redirect } from "next/navigation";
import CompanionSidebar from "@/components/companions/companion-sidebar";
import Nav from "@/components/nav";
import ThemeApplier from "@/components/theme-applier";
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
    <div className="min-h-svh md:flex">
      <ThemeApplier />
      <Nav />
      {/* No bottom padding to reserve: mobile nav and timer both live in the
          sticky top bar now, so nothing overlaps the end of the page. */}
      <main className="min-w-0 flex-1 p-4 md:p-8">{children}</main>
      <CompanionSidebar />
    </div>
  );
}
