import Link from "next/link";
import { listMembers } from "@/lib/members";
import { MobileEventForm } from "@/components/MobileEventForm";

export const dynamic = "force-dynamic";

// Full-page add-event form, reachable on every screen size (the kiosk also adds
// events by tapping the week/month grid). Centered on the wall display.
export default function NewEventPage() {
  const members = listMembers();
  return (
    <div className="h-full overflow-y-auto bg-zinc-50">
      <div className="w-full max-w-2xl mx-auto">
        <header className="px-4 lg:px-6 py-3 border-b border-zinc-200 bg-white flex items-center gap-3 sticky top-0 z-10">
          <Link href="/" aria-label="Back" className="w-10 h-10 rounded-full bg-zinc-100 flex items-center justify-center text-2xl active:bg-zinc-200">‹</Link>
          <div className="text-xl lg:text-2xl font-semibold">Add event</div>
        </header>
        <MobileEventForm members={members} />
      </div>
    </div>
  );
}
