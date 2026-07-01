import Link from "next/link";
import { listMembers } from "@/lib/members";
import { listMeals, listProposals, nextWeekStart } from "@/lib/meals";
import { MobileVote } from "@/components/MobileVote";
import { format } from "date-fns";
import { addDays } from "date-fns";

export const dynamic = "force-dynamic";

export default function MobileVotePage() {
  const members = listMembers();
  const meals = listMeals();
  const weekStart = nextWeekStart();
  const proposals = listProposals(weekStart);
  const weekLabel = `${format(new Date(`${weekStart}T12:00:00`), "MMM d")} – ${format(addDays(new Date(`${weekStart}T12:00:00`), 6), "MMM d")}`;

  return (
    <div className="min-h-full flex flex-col">
      <header className="bg-zinc-900 text-white px-5 py-4 flex items-center gap-3">
        <Link href="/m" className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center text-2xl">
          ‹
        </Link>
        <div>
          <div className="text-xl font-semibold">🗳️ Meal vote</div>
          <div className="text-xs opacity-70">{weekLabel}</div>
        </div>
      </header>
      <MobileVote
        weekStart={weekStart}
        proposals={proposals}
        meals={meals}
        members={members}
      />
    </div>
  );
}
