import { ChoreBoard } from "@/components/ChoreBoard";
import { listMembers } from "@/lib/members";
import { listChores, getCompletions, isDueOn, streakFor, listPendingCompletions, eligibleVerifiers } from "@/lib/chores";
import { listRewards, pointsBalance } from "@/lib/rewards";
import { addDays, startOfWeek } from "date-fns";
import type { ChoreCompletion } from "@/lib/types";

export const dynamic = "force-dynamic";

export default function ChoresPage() {
  const members = listMembers();
  const chores = listChores();
  const today = new Date();
  const dueToday = chores.filter((c) => isDueOn(c, today));
  const todayChores = dueToday.filter((c) => !c.shared);
  const sharedChores = dueToday.filter((c) => c.shared);

  const completionsByMember = new Map<number, ChoreCompletion[]>();
  for (const m of members) {
    completionsByMember.set(m.id, getCompletions(m.id, today, today));
  }

  // For each due common chore, the single completion (who did it), if any.
  const sharedChoreIds = new Set(sharedChores.map((c) => c.id));
  const sharedCompletionByChore = new Map<number, ChoreCompletion>();
  for (const comps of completionsByMember.values()) {
    for (const comp of comps) {
      if (sharedChoreIds.has(comp.chore_id)) sharedCompletionByChore.set(comp.chore_id, comp);
    }
  }

  const weekStart = startOfWeek(today, { weekStartsOn: 0 });
  const weekEnd = addDays(weekStart, 6);
  const weeklyStats = new Map<number, { due: number; done: number }>();
  for (const m of members) {
    let due = 0;
    const memberChores = chores.filter((c) => c.assignees.includes(m.id));
    for (let i = 0; i < 7; i++) {
      const day = addDays(weekStart, i);
      due += memberChores.filter((c) => isDueOn(c, day)).length;
    }
    const comps = getCompletions(m.id, weekStart, weekEnd);
    weeklyStats.set(m.id, { due, done: comps.length });
  }

  const streaks = new Map<number, number>();
  const balances = new Map<number, number>();
  for (const m of members) {
    streaks.set(m.id, streakFor(m.id, chores, today));
    balances.set(m.id, pointsBalance(m.id).balance);
  }

  const pending = listPendingCompletions();
  const eligibleByCompletion = new Map<number, number[]>();
  for (const p of pending) eligibleByCompletion.set(p.id, eligibleVerifiers(p));

  const rewards = listRewards(true);

  return (
    <ChoreBoard
      members={members}
      todayChores={todayChores}
      sharedChores={sharedChores}
      sharedCompletionByChore={sharedCompletionByChore}
      completionsByMember={completionsByMember}
      weeklyStats={weeklyStats}
      streaks={streaks}
      balances={balances}
      pending={pending}
      eligibleByCompletion={eligibleByCompletion}
      rewards={rewards}
    />
  );
}
