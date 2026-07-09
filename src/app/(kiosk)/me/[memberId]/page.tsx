import { notFound } from "next/navigation";
import { getMember, listMembers } from "@/lib/members";
import { listChores, getCompletions, isDueOn, streakFor, eligibleVerifiers } from "@/lib/chores";
import { pointsBalance, listRewards } from "@/lib/rewards";
import { listEventsInRange } from "@/lib/events";
import { listProposals, listMeals } from "@/lib/meals";
import { getAllSettings } from "@/lib/settings";
import { PersonalHome } from "@/components/PersonalHome";
import { addDays } from "date-fns";
import type { ChoreCompletion } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function PersonalHomePage({ params }: { params: Promise<{ memberId: string }> }) {
  const { memberId } = await params;
  const id = Number(memberId);
  const member = getMember(id);
  if (!member) notFound();

  const today = new Date();
  const chores = listChores();
  const memberChores = chores.filter((c) => c.assignees.includes(id) && isDueOn(c, today));
  const comps = getCompletions(id, today, today);
  const eligibleByCompletion = new Map<number, number[]>();
  for (const c of comps) if (!c.verified_at) eligibleByCompletion.set(c.id, eligibleVerifiers(c));
  const streak = streakFor(id, chores, today);
  const balance = pointsBalance(id);

  const rangeStart = Math.floor(today.getTime() / 1000);
  const rangeEnd = Math.floor(addDays(today, 7).getTime() / 1000);
  const allEvents = listEventsInRange(rangeStart, rangeEnd);
  const myEvents = allEvents.filter((e) => e.member_id === id).sort((a, b) => a.start_ts - b.start_ts).slice(0, 10);

  const proposals = listProposals();
  const meals = listMeals();
  const allMembers = listMembers();
  const rewards = listRewards(true);

  const settings = getAllSettings();
  const idleSeconds = Number(settings.personal_idle_seconds ?? 120);

  return (
    <PersonalHome
      member={member}
      allMembers={allMembers}
      chores={memberChores}
      completions={comps as ChoreCompletion[]}
      eligibleByCompletion={eligibleByCompletion}
      streak={streak}
      balance={balance}
      events={myEvents}
      proposals={proposals}
      meals={meals}
      rewards={rewards}
      idleSeconds={idleSeconds}
    />
  );
}
