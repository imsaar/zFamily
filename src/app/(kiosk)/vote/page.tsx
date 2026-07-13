import { listMembers } from "@/lib/members";
import { listMeals, listProposals } from "@/lib/meals";
import { MobileVote } from "@/components/MobileVote";

export const dynamic = "force-dynamic";

// First-class Meal-ideas / vote route (reachable on every screen size). Reuses
// the mobile-first voting UI, centered on the wall display.
export default function VotePage() {
  const members = listMembers();
  const meals = listMeals();
  const proposals = listProposals();
  return (
    <div className="h-full flex flex-col bg-zinc-50">
      <div className="px-4 lg:px-6 py-3 border-b border-zinc-200 bg-white shrink-0">
        <div className="text-xl lg:text-2xl font-semibold">🗳️ Meal ideas</div>
        <div className="text-xs lg:text-sm text-zinc-500">Vote on shared meals · propose future dishes</div>
      </div>
      <div className="flex-1 min-h-0 w-full max-w-3xl mx-auto flex flex-col">
        <MobileVote proposals={proposals} meals={meals} members={members} />
      </div>
    </div>
  );
}
