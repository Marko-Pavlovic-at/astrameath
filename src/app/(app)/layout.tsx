import { redirect } from "next/navigation";
import CompanionSidebar from "@/components/companions/companion-sidebar";
import Nav from "@/components/nav";
import ThemeApplier from "@/components/theme-applier";
import TimerBar from "@/components/timer-bar";
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
      {/* pb clears the mobile nav (3.25rem) AND the timer bar stacked above it */}
      <main className="min-w-0 flex-1 p-4 pb-32 md:p-8 md:pb-8">{children}</main>
      <CompanionSidebar />
      <TimerBar />
    </div>
  );
}
