import Link from "next/link";
import { notFound } from "next/navigation";
import { getMember, listMembers } from "@/lib/members";
import { listChores, getCompletions, isDueOn, streakFor, eligibleVerifiers } from "@/lib/chores";
import { pointsBalance } from "@/lib/rewards";
import { format } from "date-fns";
import type { MemberColor } from "@/lib/types";
import { COLOR_CLASSES } from "@/lib/types";
import { MobileChoreList } from "@/components/MobileChoreList";

export const dynamic = "force-dynamic";

export default async function MobileChoresForMember({ params }: { params: Promise<{ memberId: string }> }) {
  const { memberId } = await params;
  const id = Number(memberId);
  const member = getMember(id);
  if (!member) notFound();
  const today = new Date();
  const chores = listChores();
  const memberChores = chores.filter((c) => c.assignees.includes(member.id) && isDueOn(c, today));
  const comps = getCompletions(member.id, today, today);
  const eligibleByCompletion = new Map<number, number[]>();
  for (const c of comps) if (!c.verified_at) eligibleByCompletion.set(c.id, eligibleVerifiers(c));
  const streak = streakFor(member.id, chores, today);
  const balance = pointsBalance(member.id).balance;
  const color = COLOR_CLASSES[member.color as MemberColor] ?? COLOR_CLASSES.sky;
  const allMembers = listMembers();

  return (
    <div className="min-h-full flex flex-col">
      <header className={`${color.bg} text-white px-5 py-4 flex items-center gap-3`}>
        <Link href="/m" className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center text-2xl">
          ‹
        </Link>
        <div className={`w-12 h-12 rounded-full bg-white/20 flex items-center justify-center text-2xl`}>
          {member.emoji ?? member.name[0]}
        </div>
        <div className="flex-1">
          <div className="text-xl font-semibold">{member.name}</div>
          <div className="text-sm opacity-80">
            {format(today, "EEE, MMM d")}
            {streak > 0 && ` · 🔥 ${streak}`}
            {` · 🏆 ${balance}`}
          </div>
        </div>
      </header>

      <MobileChoreList
        memberId={member.id}
        colorKey={member.color as MemberColor}
        chores={memberChores}
        completions={comps}
        eligibleByCompletion={eligibleByCompletion}
        members={allMembers}
      />
    </div>
  );
}
