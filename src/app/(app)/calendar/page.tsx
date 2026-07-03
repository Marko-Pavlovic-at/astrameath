import { Suspense } from "react";
import CalendarView from "@/components/calendar/calendar-view";

export const metadata = { title: "Calendar" };

export default function CalendarPage() {
  // Suspense boundary required by useSearchParams in CalendarView
  return (
    <Suspense>
      <CalendarView />
    </Suspense>
  );
}
