import Link from "next/link";
import { listMembers } from "@/lib/members";
import { listMeals, listProposals } from "@/lib/meals";
import { MobileVote } from "@/components/MobileVote";

export const dynamic = "force-dynamic";

export default function MobileVotePage() {
  const members = listMembers();
  const meals = listMeals();
  const proposals = listProposals();

  return (
    <div className="min-h-full flex flex-col">
      <header className="bg-zinc-900 text-white px-5 py-4 flex items-center gap-3">
        <Link href="/m" className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center text-2xl">
          ‹
        </Link>
        <div>
          <div className="text-xl font-semibold">🗳️ Meal ideas</div>
          <div className="text-xs opacity-70">Vote on shared meals · propose future dishes</div>
        </div>
      </header>
      <MobileVote proposals={proposals} meals={meals} members={members} />
    </div>
  );
}
