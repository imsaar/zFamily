import Link from "next/link";
import { listMembers } from "@/lib/members";
import { listEventsInRange } from "@/lib/events";
import { listChores, getCompletions, isDueOn } from "@/lib/chores";
import { listShoppingItems } from "@/lib/meals";
import { format } from "date-fns";
import type { MemberColor } from "@/lib/types";
import { COLOR_CLASSES, memberGlyph } from "@/lib/types";

export const dynamic = "force-dynamic";

export default function MobileHome() {
  const members = listMembers();
  const today = new Date();
  const todayKey = format(today, "yyyy-MM-dd");
  const chores = listChores();
  const dueToday = chores.filter((c) => isDueOn(c, today));

  const summary = members.map((m) => {
    const memberChores = dueToday.filter((c) => c.assignees.includes(m.id));
    const done = new Set(getCompletions(m.id, today, today).map((c) => c.chore_id));
    return { member: m, total: memberChores.length, done: [...memberChores].filter((c) => done.has(c.id)).length };
  });

  const nowSec = Math.floor(Date.now() / 1000);
  const events = listEventsInRange(nowSec, nowSec + 24 * 3600)
    .filter((e) => format(new Date(e.start_ts * 1000), "yyyy-MM-dd") === todayKey)
    .slice(0, 5);

  const shopping = listShoppingItems();
  const shopActive = shopping.filter((i) => !i.checked).length;

  return (
    <div className="p-5 space-y-6 pb-24">
      <header className="flex items-center justify-between">
        <div>
          <div className="text-sm text-zinc-500">zFamily</div>
          <div className="text-2xl font-semibold">{format(today, "EEE, MMM d")}</div>
        </div>
      </header>

      <section>
        <h2 className="text-xs uppercase tracking-wider text-zinc-500 mb-2">Chores</h2>
        <div className="grid grid-cols-2 gap-3">
          {summary.map(({ member, total, done }) => {
            const color = COLOR_CLASSES[member.color as MemberColor] ?? COLOR_CLASSES.sky;
            const pct = total > 0 ? Math.round((done / total) * 100) : 0;
            return (
              <Link
                key={member.id}
                href={`/m/chores/${member.id}`}
                className="bg-white border border-zinc-200 rounded-2xl p-4 flex items-center gap-3"
              >
                <div className={`w-12 h-12 rounded-full ${color.bg} flex items-center justify-center text-2xl text-white shrink-0`}>
                  {memberGlyph(member)}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-semibold truncate">{member.name}</div>
                  <div className="text-xs text-zinc-500 tabular-nums">
                    {done}/{total} · {pct}%
                  </div>
                  <div className="mt-1 h-1.5 rounded-full bg-zinc-100 overflow-hidden">
                    <div className={`h-full ${color.bg}`} style={{ width: `${pct}%` }} />
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      </section>

      <section>
        <h2 className="text-xs uppercase tracking-wider text-zinc-500 mb-2">Today's events</h2>
        {events.length === 0 ? (
          <div className="text-sm text-zinc-400 italic">Nothing scheduled.</div>
        ) : (
          <ul className="space-y-2">
            {events.map((e) => {
              const m = e.member_id ? members.find((x) => x.id === e.member_id) : null;
              const color = m ? COLOR_CLASSES[m.color as MemberColor] : COLOR_CLASSES.sky;
              return (
                <li key={e.id} className={`bg-white border-l-4 ${color.border} rounded-xl px-4 py-3 flex items-center gap-3`}>
                  <div className="flex-1 min-w-0">
                    <div className="font-medium truncate">{e.title}</div>
                    <div className="text-xs text-zinc-500 tabular-nums">
                      {e.all_day ? "All day" : format(new Date(e.start_ts * 1000), "h:mm a")}
                      {m && ` · ${m.name}`}
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
        <Link href="/m/event" className="mt-3 block text-center py-3 rounded-xl bg-zinc-900 text-white font-medium">
          + Quick-add event
        </Link>
      </section>

      <section className="grid grid-cols-2 gap-3">
        <Link
          href="/m/shopping"
          className="bg-white border border-zinc-200 rounded-2xl p-4 flex items-center justify-between"
        >
          <div>
            <div className="text-xs uppercase tracking-wider text-zinc-500">Shopping</div>
            <div className="text-2xl font-semibold">🛒 {shopActive}</div>
          </div>
          <div className="text-zinc-400 text-2xl">›</div>
        </Link>
        <Link
          href="/m/vote"
          className="bg-white border border-zinc-200 rounded-2xl p-4 flex items-center justify-between"
        >
          <div>
            <div className="text-xs uppercase tracking-wider text-zinc-500">Meal vote</div>
            <div className="text-2xl font-semibold">🗳️</div>
          </div>
          <div className="text-zinc-400 text-2xl">›</div>
        </Link>
      </section>
    </div>
  );
}
