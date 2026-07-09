import { MealsView } from "@/components/MealsView";
import { listMeals, listPlanForRange, listShoppingItems, listProposals } from "@/lib/meals";
import { listMembers } from "@/lib/members";
import { weekDays, parseDateParam } from "@/lib/dates";
import { format } from "date-fns";

export const dynamic = "force-dynamic";

type SearchParams = Promise<{ [k: string]: string | string[] | undefined }>;

export default async function MealsPage({ searchParams }: { searchParams: SearchParams }) {
  const sp = await searchParams;
  const anchor = parseDateParam(typeof sp.d === "string" ? sp.d : null);
  const days = weekDays(anchor, 0);
  const startStr = format(days[0], "yyyy-MM-dd");
  const endStr = format(days[6], "yyyy-MM-dd");

  const meals = listMeals();
  const plan = listPlanForRange(startStr, endStr);
  const shopping = listShoppingItems();
  const members = listMembers();
  const proposals = listProposals();

  return (
    <MealsView
      days={days}
      anchor={anchor}
      meals={meals}
      plan={plan}
      shopping={shopping}
      members={members}
      proposals={proposals}
    />
  );
}
