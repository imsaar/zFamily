import Link from "next/link";
import { listMembers } from "@/lib/members";
import { MobileEventForm } from "@/components/MobileEventForm";

export const dynamic = "force-dynamic";

export default function MobileNewEvent() {
  const members = listMembers();
  return (
    <div className="min-h-full flex flex-col">
      <header className="bg-zinc-900 text-white px-5 py-4 flex items-center gap-3">
        <Link href="/m" className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center text-2xl">
          ‹
        </Link>
        <div className="text-xl font-semibold">Quick-add event</div>
      </header>
      <MobileEventForm members={members} />
    </div>
  );
}
