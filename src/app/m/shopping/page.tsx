import Link from "next/link";
import { listShoppingItems } from "@/lib/meals";
import { MobileShoppingList } from "@/components/MobileShoppingList";

export const dynamic = "force-dynamic";

export default function MobileShoppingPage() {
  const items = listShoppingItems();
  return (
    <div className="min-h-full flex flex-col">
      <header className="bg-zinc-900 text-white px-5 py-4 flex items-center gap-3">
        <Link href="/m" className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center text-2xl">
          ‹
        </Link>
        <div className="text-xl font-semibold">🛒 Shopping</div>
      </header>
      <MobileShoppingList items={items} />
    </div>
  );
}
